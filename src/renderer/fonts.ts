import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RenderError } from "../domain/errors";
import type { FontConfig } from "./types";

let cachedFontBuffer: ArrayBuffer | null = null;

const DEFAULT_FONT_PATH = resolve(
  import.meta.dir,
  "fonts",
  "Roboto-Regular.ttf",
);

export async function loadBundledFont(
  fontPath: string = DEFAULT_FONT_PATH,
): Promise<ArrayBuffer> {
  if (cachedFontBuffer && fontPath === DEFAULT_FONT_PATH) {
    return cachedFontBuffer;
  }

  try {
    const buffer = await readFile(fontPath);
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );

    if (fontPath === DEFAULT_FONT_PATH) {
      cachedFontBuffer = arrayBuffer;
    }

    return arrayBuffer;
  } catch (error) {
    throw new RenderError(
      "RENDER_FAILED",
      `Failed to load font from ${fontPath}: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  }
}

export async function getDefaultFontConfig(): Promise<FontConfig> {
  const data = await loadBundledFont();
  return {
    name: "Roboto",
    data,
    weight: 400,
    style: "normal",
  };
}

export function clearFontCache(): void {
  cachedFontBuffer = null;
}
