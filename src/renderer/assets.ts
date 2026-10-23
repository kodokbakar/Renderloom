import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, normalize, resolve } from "node:path";
import { RenderError } from "../domain/errors";

const DATA_IMAGE_PREFIX = "data:image/";
const DISALLOWED_PROTOCOLS = [
  "http:",
  "https:",
  "ftp:",
  "file:",
  "javascript:",
  "blob:",
  "data:",
];

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function isDataImageUrl(src: string): boolean {
  return src.startsWith(DATA_IMAGE_PREFIX);
}

export function isDisallowedRemoteUrl(src: string): boolean {
  const trimmed = src.trim().toLowerCase();
  if (trimmed.startsWith("//")) {
    return true;
  }
  for (const protocol of DISALLOWED_PROTOCOLS) {
    if (trimmed.startsWith(protocol)) {
      if (protocol === "data:" && trimmed.startsWith(DATA_IMAGE_PREFIX)) {
        return false;
      }
      return true;
    }
  }
  return false;
}

export function validateAssetSource(src: string, baseDir?: string): string {
  const trimmed = src.trim();

  if (trimmed.length === 0) {
    throw new RenderError("UNSUPPORTED_SYNTAX", "Image src cannot be empty");
  }

  if (isDataImageUrl(trimmed)) {
    return trimmed;
  }

  if (isDisallowedRemoteUrl(trimmed)) {
    throw new RenderError(
      "UNTRUSTED_REMOTE_ASSET",
      `Untrusted remote URL or disallowed protocol in image src: ${trimmed}`,
      { src: trimmed },
    );
  }

  if (trimmed.includes("\0") || trimmed.includes("%00")) {
    throw new RenderError(
      "UNTRUSTED_REMOTE_ASSET",
      `Null byte injection detected in asset path: ${trimmed}`,
      { src: trimmed },
    );
  }

  const normalized = normalize(trimmed);
  const segments = normalized.split(/[\/\\]/);
  if (segments.includes("..")) {
    throw new RenderError(
      "UNTRUSTED_REMOTE_ASSET",
      `Path traversal detected in asset path: ${trimmed}`,
      { src: trimmed },
    );
  }

  if (baseDir) {
    const resolvedBase = resolve(baseDir);
    const targetPath = isAbsolute(trimmed)
      ? resolve(trimmed)
      : resolve(resolvedBase, trimmed);

    if (
      !targetPath.startsWith(`${resolvedBase}/`) &&
      targetPath !== resolvedBase
    ) {
      throw new RenderError(
        "UNTRUSTED_REMOTE_ASSET",
        `Asset path escapes allowed base directory: ${trimmed}`,
        { src: trimmed, baseDir },
      );
    }
    return targetPath;
  }

  if (isAbsolute(trimmed)) {
    throw new RenderError(
      "UNTRUSTED_REMOTE_ASSET",
      `Absolute filesystem path not permitted without base directory: ${trimmed}`,
      { src: trimmed },
    );
  }

  return trimmed;
}

export async function resolveAssetToDataUri(
  src: string,
  baseDir?: string,
): Promise<string> {
  const validated = validateAssetSource(src, baseDir);
  if (isDataImageUrl(validated)) {
    return validated;
  }

  const filePath = baseDir ? validated : resolve(process.cwd(), validated);
  if (!existsSync(filePath)) {
    throw new RenderError("RENDER_FAILED", `Asset file not found: ${src}`, {
      src,
      filePath,
    });
  }

  try {
    const fileBytes = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
    const base64 = fileBytes.toString("base64");
    return `data:${mime};base64,${base64}`;
  } catch (error) {
    throw new RenderError(
      "RENDER_FAILED",
      `Failed to read asset file ${src}: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  }
}
