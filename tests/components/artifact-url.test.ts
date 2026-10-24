import { describe, expect, test } from "bun:test";
import {
  buildArtifactUrl,
  isValidArtifactFilename,
  isValidSessionId,
} from "../../src/components/utils/artifact-url";

describe("buildArtifactUrl & validation", () => {
  test("generates correct url for valid parameters", () => {
    const url = buildArtifactUrl("sess-123", "images", "candidate-1.png");
    expect(url).toBe("/api/sessions/sess-123/artifacts/images/candidate-1.png");
  });

  test("properly encodes uri components", () => {
    const url = buildArtifactUrl("session abc", "source", "card v1.tsx");
    expect(url).toBe(
      "/api/sessions/session%20abc/artifacts/source/card%20v1.tsx",
    );
  });

  test("supports all four artifact types", () => {
    expect(buildArtifactUrl("s1", "images", "img.png")).toContain(
      "/artifacts/images/",
    );
    expect(buildArtifactUrl("s1", "source", "code.tsx")).toContain(
      "/artifacts/source/",
    );
    expect(buildArtifactUrl("s1", "svg", "vector.svg")).toContain(
      "/artifacts/svg/",
    );
    expect(buildArtifactUrl("s1", "assets", "font.ttf")).toContain(
      "/artifacts/assets/",
    );
  });

  test("rejects invalid artifact type", () => {
    expect(() => buildArtifactUrl("s1", "executables", "file.exe")).toThrow(
      "Invalid artifact type",
    );
    expect(() => buildArtifactUrl("s1", "../images", "file.png")).toThrow(
      "Invalid artifact type",
    );
  });

  test("rejects path traversal in session ID", () => {
    expect(() => buildArtifactUrl("../sess", "images", "out.png")).toThrow();
    expect(() => buildArtifactUrl("sess/other", "images", "out.png")).toThrow();
    expect(() =>
      buildArtifactUrl("sess\\other", "images", "out.png"),
    ).toThrow();
    expect(() => buildArtifactUrl("sess%2e%2e", "images", "out.png")).toThrow();
    expect(() => buildArtifactUrl("sess\0", "images", "out.png")).toThrow();
    expect(isValidSessionId("")).toBe(false);
    expect(isValidSessionId("   ")).toBe(false);
  });

  test("rejects path traversal in filename", () => {
    expect(() => buildArtifactUrl("s1", "images", "../secret.png")).toThrow();
    expect(() => buildArtifactUrl("s1", "images", "dir/secret.png")).toThrow();
    expect(() => buildArtifactUrl("s1", "images", "dir\\secret.png")).toThrow();
    expect(() =>
      buildArtifactUrl("s1", "images", "%2e%2e%2fsecret.png"),
    ).toThrow();
    expect(() => buildArtifactUrl("s1", "images", "out.png\0")).toThrow();
    expect(isValidArtifactFilename("")).toBe(false);
    expect(isValidArtifactFilename("  ")).toBe(false);
  });
});
