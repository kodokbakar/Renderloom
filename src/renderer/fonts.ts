import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RenderError } from "../domain/errors";
import type { FontConfig } from "./types";

const fontBufferCache = new Map<string, ArrayBuffer>();

export const DEFAULT_FONT_PATH = resolve(
  import.meta.dir,
  "fonts",
  "Roboto-Regular.ttf",
);

export const SYMBOL_FONT_PATH = resolve(
  import.meta.dir,
  "fonts",
  "NotoSansSymbols-Regular.ttf",
);

export async function loadBundledFont(
  fontPath: string = DEFAULT_FONT_PATH,
): Promise<ArrayBuffer> {
  const cached = fontBufferCache.get(fontPath);
  if (cached) {
    return cached;
  }

  try {
    const buffer = await readFile(fontPath);
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );

    fontBufferCache.set(fontPath, arrayBuffer);
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
  const data = await loadBundledFont(DEFAULT_FONT_PATH);
  return {
    name: "Roboto",
    data,
    weight: 400,
    style: "normal",
  };
}

export async function getSymbolFontConfig(): Promise<FontConfig> {
  const data = await loadBundledFont(SYMBOL_FONT_PATH);
  return {
    name: "Noto Sans Symbols",
    data,
    weight: 400,
    style: "normal",
  };
}

export async function getDefaultFontConfigs(): Promise<FontConfig[]> {
  const [roboto, symbols] = await Promise.all([
    getDefaultFontConfig(),
    getSymbolFontConfig(),
  ]);
  return [roboto, symbols];
}

export function clearFontCache(): void {
  fontBufferCache.clear();
}
