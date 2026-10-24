import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { MAX_RENDER_DURATION_MS, MAX_SVG_BYTES } from "../domain/dimensions";
import { RenderError } from "../domain/errors";
import { getDefaultFontConfig } from "./fonts";
import { interpretJsx } from "./interpreter";
import { verifyPngDimensions } from "./png";
import type { RenderOptions, RenderResult, VNode } from "./types";
import { validateJsx } from "./validator";

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
    const defaultFont = await getDefaultFontConfig();
    fonts = [defaultFont];
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
