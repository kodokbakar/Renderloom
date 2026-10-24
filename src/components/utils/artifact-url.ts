export type ArtifactType = "images" | "source" | "svg" | "assets";

const VALID_TYPES: Record<ArtifactType, true> = {
  images: true,
  source: true,
  svg: true,
  assets: true,
};

function hasPathTraversal(val: string): boolean {
  if (val.includes("\0") || val.includes("/") || val.includes("\\")) {
    return true;
  }
  // Check for dot-dot patterns directly
  if (
    val === ".." ||
    val.startsWith("../") ||
    val.startsWith("..\\") ||
    val.includes("/../") ||
    val.includes("\\..\\")
  ) {
    return true;
  }
  // Check after decoding
  try {
    const decoded = decodeURIComponent(val);
    if (
      decoded.includes("\0") ||
      decoded.includes("/") ||
      decoded.includes("\\") ||
      decoded === ".." ||
      decoded.includes("..")
    ) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

export function isValidSessionId(sessionId: string): boolean {
  if (!sessionId || typeof sessionId !== "string") return false;
  const trimmed = sessionId.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return false;
  if (hasPathTraversal(trimmed)) return false;
  return true;
}

export function isValidArtifactFilename(filename: string): boolean {
  if (!filename || typeof filename !== "string") return false;
  const trimmed = filename.trim();
  if (trimmed.length === 0 || trimmed.length > 255) return false;
  if (hasPathTraversal(trimmed)) return false;
  return true;
}
export function buildArtifactUrl(
  sessionId: string,
  type: string,
  filename: string,
): string {
  if (!isValidSessionId(sessionId)) {
    throw new Error(
      `Invalid sessionId: '${sessionId}' contains invalid characters or traversal`,
    );
  }
  if (!VALID_TYPES[type as ArtifactType]) {
    throw new Error(
      `Invalid artifact type: '${type}'. Expected one of: images, source, svg, assets`,
    );
  }
  if (!isValidArtifactFilename(filename)) {
    throw new Error(
      `Invalid filename: '${filename}' contains invalid characters or traversal`,
    );
  }

  const encodedId = encodeURIComponent(sessionId.trim());
  const encodedType = encodeURIComponent(type);
  const encodedFilename = encodeURIComponent(filename.trim());

  return `/api/sessions/${encodedId}/artifacts/${encodedType}/${encodedFilename}`;
}
