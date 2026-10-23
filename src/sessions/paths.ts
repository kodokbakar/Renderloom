import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { SessionError } from "../domain/errors";

const VALID_ARTIFACT_TYPES: Record<string, true> = {
  images: true,
  source: true,
  svg: true,
  assets: true,
};

const SAFE_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9_-][a-zA-Z0-9_\-\.]*$/;

export function resolveOutputsDir(customOutputsDir?: string): string {
  const dir = customOutputsDir
    ? path.resolve(customOutputsDir)
    : path.resolve(process.cwd(), "Outputs");
  return dir;
}

export function getCanonicalPath(filePath: string): string {
  if (existsSync(filePath)) {
    return realpathSync(filePath);
  }
  // If path doesn't exist, canonicalize the closest existing ancestor
  const parent = path.dirname(filePath);
  if (parent !== filePath && existsSync(parent)) {
    return path.join(realpathSync(parent), path.basename(filePath));
  }
  return path.resolve(filePath);
}

export function validateSessionPath(baseDir: string, slug: string): string {
  if (!slug || typeof slug !== "string") {
    throw new SessionError(
      "INVALID_SESSION_NAME",
      "Session slug cannot be empty",
    );
  }

  if (
    slug.includes("\0") ||
    slug.includes("/") ||
    slug.includes("\\") ||
    slug.includes("..")
  ) {
    throw new SessionError(
      "INVALID_PATH",
      `Invalid characters or traversal in slug: ${slug}`,
    );
  }

  if (!SAFE_SLUG_PATTERN.test(slug)) {
    throw new SessionError(
      "INVALID_SESSION_NAME",
      `Session slug '${slug}' must contain only lowercase alphanumeric characters, hyphens, and underscores`,
    );
  }

  if (slug.length > 100) {
    throw new SessionError(
      "INVALID_SESSION_NAME",
      "Session slug exceeds maximum length of 100 characters",
    );
  }

  const resolvedBase = path.resolve(baseDir);
  const targetPath = path.resolve(resolvedBase, slug);

  // Standard boundary check
  if (!targetPath.startsWith(resolvedBase + path.sep)) {
    throw new SessionError("INVALID_PATH", `Path traversal detected: ${slug}`);
  }

  // Symlink escape check
  const canonicalBase = getCanonicalPath(resolvedBase);
  const canonicalTarget = getCanonicalPath(targetPath);

  if (
    canonicalTarget !== canonicalBase &&
    !canonicalTarget.startsWith(canonicalBase + path.sep)
  ) {
    throw new SessionError(
      "INVALID_PATH",
      `Symlink escape detected for slug: ${slug}`,
    );
  }

  return targetPath;
}

export function validateArtifactPath(
  baseDir: string,
  slug: string,
  type: string,
  filename: string,
): string {
  if (!VALID_ARTIFACT_TYPES[type]) {
    throw new SessionError(
      "INVALID_PATH",
      `Invalid artifact directory type: ${type}`,
    );
  }

  if (!filename || typeof filename !== "string") {
    throw new SessionError("INVALID_PATH", "Artifact filename cannot be empty");
  }

  if (
    filename.includes("\0") ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..") ||
    filename.startsWith(".")
  ) {
    throw new SessionError(
      "INVALID_PATH",
      `Invalid characters or path traversal in artifact filename: ${filename}`,
    );
  }

  if (!SAFE_FILENAME_PATTERN.test(filename)) {
    throw new SessionError(
      "INVALID_PATH",
      `Artifact filename '${filename}' contains unsafe characters`,
    );
  }

  const sessionPath = validateSessionPath(baseDir, slug);
  const typeDir = path.resolve(sessionPath, type);
  const artifactPath = path.resolve(typeDir, filename);

  // Ensure artifact stays strictly within typeDir
  if (!artifactPath.startsWith(typeDir + path.sep)) {
    throw new SessionError(
      "INVALID_PATH",
      `Artifact path traversal detected: ${filename}`,
    );
  }

  // Symlink escape check for artifact
  const canonicalTypeDir = getCanonicalPath(typeDir);
  const canonicalArtifact = getCanonicalPath(artifactPath);

  if (
    canonicalArtifact !== canonicalTypeDir &&
    !canonicalArtifact.startsWith(canonicalTypeDir + path.sep)
  ) {
    throw new SessionError(
      "INVALID_PATH",
      `Symlink escape detected for artifact: ${filename}`,
    );
  }

  return artifactPath;
}
