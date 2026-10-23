import { describe, expect, test } from "bun:test";
import { createSessionSlug, sanitizeSlug } from "../../src/sessions/slug";

describe("Slug Generator and Sanitization", () => {
  test("converts normal session names to lowercase hyphenated slugs", () => {
    expect(sanitizeSlug("My Bauhaus Poster")).toBe("my-bauhaus-poster");
    expect(sanitizeSlug("Swiss Grid Design 2026")).toBe(
      "swiss-grid-design-2026",
    );
  });

  test("strips special characters and collapses hyphens", () => {
    expect(sanitizeSlug("Hello / World !!! $#@")).toBe("hello-world");
    expect(sanitizeSlug("Design --- Test")).toBe("design-test");
    expect(sanitizeSlug("   trimmed spaces   ")).toBe("trimmed-spaces");
  });

  test("safely handles hostile inputs by falling back to session", () => {
    expect(sanitizeSlug("")).toBe("session");
    expect(sanitizeSlug("   ")).toBe("session");
    expect(sanitizeSlug("../../etc/passwd")).toBe("etc-passwd");
    expect(sanitizeSlug("../..")).toBe("session");
    expect(sanitizeSlug("???!!!")).toBe("session");
    expect(sanitizeSlug("\0nullbyte\0")).toBe("nullbyte");
  });

  test("caps slug length at 64 characters", () => {
    const longName = "a".repeat(100);
    const slug = sanitizeSlug(longName);
    expect(slug.length).toBe(64);
  });

  test("createSessionSlug generates collision-free slugs", () => {
    const taken = new Set(["poster", "poster-2", "poster-3"]);
    const slug = createSessionSlug("Poster", (s) => taken.has(s));
    expect(slug).toBe("poster-4");

    const taken2 = (s: string) => s === "my-design";
    expect(createSessionSlug("My Design", taken2)).toBe("my-design-2");
  });
});
