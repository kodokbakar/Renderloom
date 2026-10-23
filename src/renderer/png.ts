import { RenderError } from "../domain/errors";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR_CHUNK_TYPE = [0x49, 0x48, 0x44, 0x52]; // ASCII "IHDR"

export interface PngDimensions {
  width: number;
  height: number;
}

export function readPngDimensions(buffer: Uint8Array | Buffer): PngDimensions {
  if (buffer.byteLength < 24) {
    throw new RenderError(
      "RENDER_FAILED",
      `Invalid PNG: buffer too small (${buffer.byteLength} bytes, expected at least 24 bytes)`,
    );
  }

  for (let i = 0; i < PNG_MAGIC.length; i++) {
    if (buffer[i] !== PNG_MAGIC[i]) {
      throw new RenderError(
        "RENDER_FAILED",
        "Invalid PNG: missing standard PNG signature magic bytes",
      );
    }
  }

  for (let i = 0; i < IHDR_CHUNK_TYPE.length; i++) {
    if (buffer[12 + i] !== IHDR_CHUNK_TYPE[i]) {
      throw new RenderError(
        "RENDER_FAILED",
        "Invalid PNG: missing or misplaced IHDR chunk",
      );
    }
  }

  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);

  if (width === 0 || height === 0) {
    throw new RenderError(
      "RENDER_FAILED",
      `Invalid PNG: dimensions cannot be zero (${width}x${height})`,
    );
  }

  return { width, height };
}

export function verifyPngDimensions(
  buffer: Uint8Array | Buffer,
  expectedWidth: number,
  expectedHeight: number,
): PngDimensions {
  const actual = readPngDimensions(buffer);

  if (actual.width !== expectedWidth || actual.height !== expectedHeight) {
    throw new RenderError(
      "RENDER_FAILED",
      `PNG dimensions mismatch: expected ${expectedWidth}x${expectedHeight}, got ${actual.width}x${actual.height}`,
      {
        expected: { width: expectedWidth, height: expectedHeight },
        actual,
      },
    );
  }

  return actual;
}
