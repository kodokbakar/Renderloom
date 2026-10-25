import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { MAX_RENDER_DURATION_MS, MAX_SVG_BYTES } from "../domain/dimensions";
import { RenderError } from "../domain/errors";
import { getDefaultFontConfigs, getSymbolFontConfig } from "./fonts";
import { interpretJsx } from "./interpreter";
import { verifyPngDimensions } from "./png";
import type { RenderOptions, RenderResult, VNode } from "./types";
import { validateJsx } from "./validator";

const emojiCache = new Map<string, string>();

export function clearEmojiCache(): void {
  emojiCache.clear();
}

let twemojiDir: string | null = null;

function getTwemojiDir(): string {
  if (twemojiDir) {
    return twemojiDir;
  }
  try {
    const pkgPath = import.meta.resolve("@twemoji/svg/package.json");
    twemojiDir = dirname(
      pkgPath.startsWith("file://") ? fileURLToPath(pkgPath) : pkgPath,
    );
  } catch {
    twemojiDir = resolve(process.cwd(), "node_modules", "@twemoji/svg");
  }
  return twemojiDir;
}

function getEmojiCodePointCandidates(str: string): string[] {
  if (!str) return [];

  const rawPoints: string[] = [];
  for (const char of str) {
    const cp = char.codePointAt(0);
    if (cp !== undefined) {
      rawPoints.push(cp.toString(16));
    }
  }
  const full = rawPoints.join("-");

  const strippedPoints: string[] = [];
  for (const char of str) {
    const cp = char.codePointAt(0);
    if (cp !== undefined && cp !== 0xfe0f) {
      strippedPoints.push(cp.toString(16));
    }
  }
  const stripped = strippedPoints.join("-");

  if (full === stripped) {
    return [full];
  }
  if (str.includes("\u200D")) {
    return [full, stripped];
  }
  return [stripped, full];
}

const CODEPOINT_REGEX = /^[0-9a-f]+(-[0-9a-f]+)*$/;

export async function loadLocalEmoji(
  segment: string,
): Promise<string | undefined> {
  const cached = emojiCache.get(segment);
  if (cached !== undefined) {
    return cached;
  }

  const candidates = getEmojiCodePointCandidates(segment);
  const baseDir = getTwemojiDir();

  for (const candidate of candidates) {
    if (!CODEPOINT_REGEX.test(candidate)) {
      continue;
    }

    const possiblePaths = [
      resolve(baseDir, `${candidate}.svg`),
      resolve(baseDir, "svg", `${candidate}.svg`),
    ];

    for (const filePath of possiblePaths) {
      try {
        const svgContent = await readFile(filePath, "utf-8");
        const base64 = Buffer.from(svgContent, "utf-8").toString("base64");
        const dataUri = `data:image/svg+xml;base64,${base64}`;
        emojiCache.set(segment, dataUri);
        return dataUri;
      } catch {
        // Continue searching candidates
      }
    }
  }

  return undefined;
}
export async function renderVNode(
  vnode: VNode,
  options: RenderOptions,
): Promise<RenderResult> {
  const { width, height } = options;

  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    throw new RenderError(
      "UNSUPPORTED_SYNTAX",
      `Invalid render dimensions: width (${width}) and height (${height}) must be positive integers`,
    );
  }

  const roundedWidth = Math.round(width);
  const roundedHeight = Math.round(height);

  let fonts = options.fonts;
  if (!fonts || fonts.length === 0) {
    fonts = await getDefaultFontConfigs();
  } else {
    const hasSymbols = fonts.some((f) => f.name === "Noto Sans Symbols");
    if (!hasSymbols) {
      const symbolFont = await getSymbolFontConfig();
      fonts = [...fonts, symbolFont];
    }
  }

  const satoriFonts = fonts.map((f) => ({
    name: f.name,
    data: f.data,
    weight: f.weight ?? 400,
    style: f.style ?? "normal",
  }));

  const timeoutMs = options.timeoutMs ?? MAX_RENDER_DURATION_MS;

  const runLayoutAndRaster = async (): Promise<RenderResult> => {
    let svg: string;
    try {
      svg = await satori(vnode as Parameters<typeof satori>[0], {
        width: roundedWidth,
        height: roundedHeight,
        fonts: satoriFonts,
        loadAdditionalAsset: async (languageCode: string, segment: string) => {
          if (languageCode === "emoji") {
            const asset = await loadLocalEmoji(segment);
            return (asset ?? undefined) as unknown as string;
          }
          return undefined as unknown as string;
        },
      });
    } catch (error) {
      if (error instanceof RenderError) {
        throw error;
      }
      throw new RenderError(
        "RENDER_FAILED",
        `Satori layout failed: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }

    const svgBytes = Buffer.byteLength(svg, "utf8");
    if (svgBytes > MAX_SVG_BYTES) {
      throw new RenderError(
        "RENDER_FAILED",
        `Generated SVG size exceeds maximum allowed size of ${MAX_SVG_BYTES} bytes (${svgBytes} bytes)`,
        { byteLength: svgBytes, maxBytes: MAX_SVG_BYTES },
      );
    }

    let pngBuffer: Buffer;
    try {
      const resvg = new Resvg(svg, {
        fitTo: { mode: "original" },
      });
      const rendered = resvg.render();
      pngBuffer = rendered.asPng();
    } catch (error) {
      if (error instanceof RenderError) {
        throw error;
      }
      throw new RenderError(
        "RENDER_FAILED",
        `Resvg rasterization failed: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }

    verifyPngDimensions(pngBuffer, roundedWidth, roundedHeight);

    return {
      svg,
      png: pngBuffer,
      width: roundedWidth,
      height: roundedHeight,
    };
  };

  if (timeoutMs <= 0) {
    return runLayoutAndRaster();
  }

  const { promise: timeoutPromise, reject } = Promise.withResolvers<never>();
  const timer = setTimeout(() => {
    reject(
      new RenderError(
        "RENDER_FAILED",
        `Render duration exceeded timeout of ${timeoutMs}ms`,
        { timeoutMs },
      ),
    );
  }, timeoutMs);

  try {
    return await Promise.race([runLayoutAndRaster(), timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

export async function render(
  jsxSource: string,
  options: RenderOptions,
): Promise<RenderResult> {
  const validated = validateJsx(jsxSource, { baseDir: options.baseDir });
  const vnode = await interpretJsx(validated, { baseDir: options.baseDir });
  return renderVNode(vnode, options);
}
