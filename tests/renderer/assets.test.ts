import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { RenderError } from "../../src/domain/errors";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  isDataImageUrl,
  isDisallowedRemoteUrl,
  resolveAssetToDataUri,
  validateAssetSource,
  validateCssUrls,
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
      expect(isDisallowedRemoteUrl("gopher://localhost:11211")).toBe(true);
      expect(isDisallowedRemoteUrl("ws://evil.com")).toBe(true);
      expect(isDisallowedRemoteUrl("ldap://evil.com")).toBe(true);
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
      const valid = validateAssetSource("artifacts/sample-card.png", baseDir);
      expect(valid.startsWith(baseDir)).toBe(true);
    });

    test("rejects relative filesystem paths when baseDir is undefined", () => {
      const paths = [
        "package.json",
        ".env",
        "image.png",
        "./image.png",
        "assets/logo.png",
      ];
      for (const p of paths) {
        expect(() => validateAssetSource(p)).toThrow(RenderError);
        try {
          validateAssetSource(p);
        } catch (err) {
          expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
        }
      }
    });

    test("rejects non-image file extensions even with baseDir", () => {
      const baseDir = resolve(import.meta.dir, "../fixtures");
      const disallowedFiles = [
        "sample-card.jsx",
        "secret.txt",
        "package.json",
        ".env",
        "script.sh",
      ];
      for (const file of disallowedFiles) {
        expect(() => validateAssetSource(file, baseDir)).toThrow(RenderError);
        try {
          validateAssetSource(file, baseDir);
        } catch (err) {
          expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
        }
      }
    });

    test("rejects non-standard URI schemes with UNTRUSTED_REMOTE_ASSET", () => {
      const schemes = [
        "gopher://localhost:11211",
        "ws://evil.com/stream",
        "ldap://evil.com/dc",
      ];
      for (const s of schemes) {
        expect(() => validateAssetSource(s)).toThrow(RenderError);
        try {
          validateAssetSource(s);
        } catch (err) {
          expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
        }
      }
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
        "fixtures/artifacts/sample-card.png",
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

  describe("CSS URL Validator", () => {
    test("rejects remote URLs in CSS styles", () => {
      const remoteCssValues = [
        "url(http://evil.com/leak.png)",
        "url('https://evil.com/leak.png')",
        'url("https://evil.com/leak.png")',
        "url(//evil.com/leak.png)",
        "url(ftp://evil.com/leak.png)",
        "url('gopher://localhost:11211')",
        "url(data:text/html,<script>)",
        "linear-gradient(red, blue), url(https://evil.com/test.png)",
      ];

      for (const val of remoteCssValues) {
        expect(() => validateCssUrls(val)).toThrow(RenderError);
        try {
          validateCssUrls(val);
        } catch (err) {
          expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
        }
      }
    });

    test("permits safe data:image and local fragment URLs in CSS styles", () => {
      expect(() =>
        validateCssUrls("url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==)"),
      ).not.toThrow();
      expect(() => validateCssUrls("url(#myGradient)")).not.toThrow();
    });
  });
});
