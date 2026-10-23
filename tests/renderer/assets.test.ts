import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { RenderError } from "../../src/domain/errors";
import {
  isDataImageUrl,
  isDisallowedRemoteUrl,
  resolveAssetToDataUri,
  validateAssetSource,
} from "../../src/renderer/assets";

describe("Asset Resolver and Security Guard", () => {
  describe("Protocol and Scheme Detection", () => {
    test("detects data:image URLs", () => {
      expect(isDataImageUrl("data:image/png;base64,abc")).toBe(true);
      expect(isDataImageUrl("data:image/svg+xml;utf8,<svg></svg>")).toBe(true);
      expect(isDataImageUrl("data:text/plain;base64,abc")).toBe(false);
      expect(isDataImageUrl("http://example.com/pic.png")).toBe(false);
    });

    test("detects disallowed remote URLs and protocols", () => {
      expect(isDisallowedRemoteUrl("http://evil.com/pic.png")).toBe(true);
      expect(isDisallowedRemoteUrl("https://evil.com/pic.png")).toBe(true);
      expect(isDisallowedRemoteUrl("//evil.com/pic.png")).toBe(true);
      expect(isDisallowedRemoteUrl("ftp://evil.com/file")).toBe(true);
      expect(isDisallowedRemoteUrl("javascript:alert(1)")).toBe(true);
      expect(isDisallowedRemoteUrl("file:///etc/passwd")).toBe(true);
      expect(isDisallowedRemoteUrl("blob:http://evil.com/uuid")).toBe(true);
      expect(
        isDisallowedRemoteUrl("data:text/html,<script>alert(1)</script>"),
      ).toBe(true);
      expect(isDisallowedRemoteUrl("data:image/png;base64,abc")).toBe(false);
      expect(isDisallowedRemoteUrl("assets/logo.png")).toBe(false);
    });
  });

  describe("Validation Rules", () => {
    test("rejects empty src", () => {
      expect(() => validateAssetSource("")).toThrow(RenderError);
      expect(() => validateAssetSource("   ")).toThrow(RenderError);
    });

    test("rejects remote URLs with UNTRUSTED_REMOTE_ASSET error code", () => {
      try {
        validateAssetSource("https://api.evil.com/exfil");
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
      }
    });

    test("rejects protocol-relative URLs", () => {
      try {
        validateAssetSource("//cdn.evil.com/hack.png");
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
      }
    });

    test("rejects path traversal with .. segments", () => {
      const traversalAttempts = [
        "../etc/passwd",
        "../../shadow",
        "assets/../../escape",
        "..\\windows\\system32",
      ];

      for (const attempt of traversalAttempts) {
        expect(() => validateAssetSource(attempt)).toThrow(RenderError);
        try {
          validateAssetSource(attempt);
        } catch (err) {
          expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
        }
      }
    });

    test("rejects null byte injection", () => {
      try {
        validateAssetSource("safe.png\0.jpg");
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
      }
    });

    test("rejects paths escaping base directory", () => {
      const baseDir = "/tmp/renderloom/session-01/assets";
      try {
        validateAssetSource("../../other-session/secret.png", baseDir);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
      }
    });

    test("permits safe relative path within base directory", () => {
      const baseDir = resolve(import.meta.dir, "../fixtures");
      const valid = validateAssetSource("sample-card.jsx", baseDir);
      expect(valid.startsWith(baseDir)).toBe(true);
    });

    test("permits valid data:image URL directly", () => {
      const dataUri =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
      const result = validateAssetSource(dataUri);
      expect(result).toBe(dataUri);
    });
  });

  describe("Asset Resolution to Data URI", () => {
    test("passes through data:image URL unchanged", async () => {
      const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
      const resolved = await resolveAssetToDataUri(dataUri);
      expect(resolved).toBe(dataUri);
    });

    test("reads local file and returns base64 data URI", async () => {
      const baseDir = resolve(import.meta.dir, "..");
      const resolved = await resolveAssetToDataUri(
        "fixtures/sample-card.jsx",
        baseDir,
      );
      expect(resolved.startsWith("data:")).toBe(true);
      expect(resolved.includes(";base64,")).toBe(true);
    });

    test("throws RENDER_FAILED for missing local file", async () => {
      const baseDir = resolve(import.meta.dir, "../fixtures");
      try {
        await resolveAssetToDataUri("nonexistent-file.png", baseDir);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("RENDER_FAILED");
      }
    });
  });
});
