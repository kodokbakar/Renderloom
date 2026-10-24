import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, normalize, resolve } from "node:path";
import { MAX_ASSET_BYTES } from "../domain/dimensions";
import { RenderError } from "../domain/errors";

const DATA_IMAGE_PREFIX = "data:image/";
const URI_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export const ALLOWED_IMAGE_EXTENSIONS: Record<string, true> = {
  ".png": true,
  ".jpg": true,
  ".jpeg": true,
  ".svg": true,
  ".webp": true,
  ".gif": true,
};

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function isDataImageUrl(src: string): boolean {
  return src.trim().toLowerCase().startsWith(DATA_IMAGE_PREFIX);
}

export function isDisallowedRemoteUrl(src: string): boolean {
  const trimmed = src.trim();
  if (trimmed.startsWith("//")) {
    return true;
  }
  const match = trimmed.match(URI_SCHEME_REGEX);
  if (match) {
    return !trimmed.toLowerCase().startsWith(DATA_IMAGE_PREFIX);
  }
  return false;
}

export function validateCssUrls(cssValue: string): void {
  const matches = cssValue.matchAll(
    /url\(\s*(?:(['"])(.*?)\1|([^'"\)]*))\s*\)/gi,
  );
  for (const match of matches) {
    const rawUrl = (match[2] ?? match[3] ?? "").trim();
    const cleanUrl = rawUrl.replace(/\\/g, "");
    if (isDisallowedRemoteUrl(cleanUrl)) {
      throw new RenderError(
        "UNTRUSTED_REMOTE_ASSET",
        `Untrusted remote URL in CSS style: ${rawUrl}`,
        { url: rawUrl },
      );
    }
  }
}

export function validateAssetSource(src: string, baseDir?: string): string {
  const trimmed = src.trim();

  if (trimmed.length === 0) {
    throw new RenderError("UNSUPPORTED_SYNTAX", "Image src cannot be empty");
  }

  if (isDataImageUrl(trimmed)) {
    const commaIndex = trimmed.indexOf(",");
    if (commaIndex !== -1) {
      const meta = trimmed.slice(0, commaIndex);
      const payload = trimmed.slice(commaIndex + 1);
      const byteLength = meta.includes(";base64")
        ? Buffer.from(payload, "base64").byteLength
        : Buffer.byteLength(decodeURIComponent(payload), "utf8");
      if (byteLength > MAX_ASSET_BYTES) {
        throw new RenderError(
          "UNTRUSTED_REMOTE_ASSET",
          `Data URI asset exceeds maximum allowed size of ${MAX_ASSET_BYTES} bytes (${byteLength} bytes)`,
          { src: trimmed, byteLength, maxBytes: MAX_ASSET_BYTES },
        );
      }
    }
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
  if (!baseDir) {
    throw new RenderError(
      "UNTRUSTED_REMOTE_ASSET",
      `Relative and filesystem asset paths are not permitted without base directory: ${trimmed}`,
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

  const ext = extname(targetPath).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS[ext]) {
    throw new RenderError(
      "UNTRUSTED_REMOTE_ASSET",
      `Disallowed asset file extension: ${ext || "(none)"}. Allowed extensions: ${Object.keys(ALLOWED_IMAGE_EXTENSIONS).join(", ")}`,
      { src: trimmed, ext },
    );
  }

  return targetPath;
}

export async function resolveAssetToDataUri(
  src: string,
  baseDir?: string,
): Promise<string> {
  const validated = validateAssetSource(src, baseDir);
  if (isDataImageUrl(validated)) {
    return validated;
  }

  const filePath = validated;
  if (!existsSync(filePath)) {
    throw new RenderError("RENDER_FAILED", `Asset file not found: ${src}`, {
      src,
      filePath,
    });
  }

  try {
    const fileBytes = await readFile(filePath);
    if (fileBytes.byteLength > MAX_ASSET_BYTES) {
      throw new RenderError(
        "UNTRUSTED_REMOTE_ASSET",
        `Asset file exceeds maximum allowed size of ${MAX_ASSET_BYTES} bytes (${fileBytes.byteLength} bytes)`,
        {
          src,
          filePath,
          byteLength: fileBytes.byteLength,
          maxBytes: MAX_ASSET_BYTES,
        },
      );
    }
    const ext = extname(filePath).toLowerCase();
    const mime = MIME_BY_EXT[ext];
    if (!mime) {
      throw new RenderError(
        "UNTRUSTED_REMOTE_ASSET",
        `Unsupported asset file extension: ${ext}`,
        { src, filePath, ext },
      );
    }
    const base64 = fileBytes.toString("base64");
    return `data:${mime};base64,${base64}`;
  } catch (error) {
    if (error instanceof RenderError) {
      throw error;
    }
    throw new RenderError(
      "RENDER_FAILED",
      `Failed to read asset file ${src}: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  }
}
