import { randomBytes } from "node:crypto";

/**
 * Sanitizes an arbitrary string into a filesystem-safe lowercase slug.
 * Hostile or empty inputs safely fall back to "session".
 */
export function sanitizeSlug(input: string): string {
  if (!input || typeof input !== "string") {
    return "session";
  }

  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug.length > 0 ? slug : "session";
}

/**
 * Generates a collision-safe slug. If the base slug is already taken,
 * appends a unique short suffix.
 */
export function createSessionSlug(
  name: string,
  isTaken?: (slug: string) => boolean,
): string {
  const base = sanitizeSlug(name);
  if (!isTaken || !isTaken(base)) {
    return base;
  }

  // Generate unique suffix
  for (let attempt = 1; attempt <= 100; attempt++) {
    const suffix =
      attempt <= 5 ? String(attempt + 1) : randomBytes(3).toString("hex");
    const candidate = `${base}-${suffix}`;
    if (!isTaken(candidate)) {
      return candidate;
    }
  }

  return `${base}-${Date.now()}`;
}
