import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { RenderError } from "../../src/domain/errors";
import {
  isDataImageUrl,
  isDisallowedRemoteUrl,
  resolveAssetToDataUri,
  validateAssetSource,
  validateCssUrls,
} from "../../src/renderer/assets";
import { render } from "../../src/renderer/render";
import { validateJsx } from "../../src/renderer/validator";

describe("Phase 1 Round 2 Independent Security & Edge-Case Verification", () => {
  const fixturesDir = resolve(import.meta.dir, "../fixtures");

  describe("Criterion 1: CSS url(...) SSRF in style attributes", () => {
    test("rejects various remote URLs and protocols inside CSS url()", () => {
      const maliciousCss = [
        'url("http://169.254.169.254/latest/meta-data")',
        "url('https://internal.service/api/keys')",
        "url(//169.254.169.254/secret)",
        "url(ftp://files.internal/secret.txt)",
        "url('gopher://127.0.0.1:6379/_FLUSHALL')",
        "url(ws://evil.com/socket)",
        "url(wss://evil.com/socket)",
        "url(ldap://127.0.0.1:389/o=anonymous)",
        "url(file:///etc/passwd)",
        "url(blob:http://localhost:3000/some-guid)",
        "url('data:text/html;base64,PHNjcmlwdD4=')",
        "url('data:application/javascript;base64,YWxlcnQoMSk=')",
      ];

      for (const css of maliciousCss) {
        expect(() => validateCssUrls(css)).toThrow(RenderError);
        try {
          validateCssUrls(css);
        } catch (err) {
          expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
        }
      }
    });

    test("handles case-insensitivity, escapes, and whitespace in CSS url()", () => {
      const edgeCases = [
        "URL('http://evil.com/leak.png')",
        'UrL("https://evil.com/leak.png")',
        "url(  \t 'http://evil.com/test.png' \t )",
        "url(http:\\/\\/evil.com\\/leak.png)",
        "URL(  http://evil.com  )",
      ];

      for (const css of edgeCases) {
        expect(() => validateCssUrls(css)).toThrow(RenderError);
        try {
          validateCssUrls(css);
        } catch (err) {
          expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
        }
      }
    });

    test("detects SSRF when multiple url() calls are combined in one style property", () => {
      const multiUrl =
        "url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==), url('http://evil.com/probe.png')";

      expect(() => validateCssUrls(multiUrl)).toThrow(RenderError);
      try {
        validateCssUrls(multiUrl);
      } catch (err) {
        expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
      }
    });

    test("allows safe data:image and fragment identifiers in CSS url()", () => {
      const safeCss = [
        "url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==)",
        "url('DATA:IMAGE/PNG;BASE64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')",
        "url(#gradientFilter)",
        "none",
        "linear-gradient(180deg, #ff0000 0%, #0000ff 100%)",
      ];

      for (const css of safeCss) {
        expect(() => validateCssUrls(css)).not.toThrow();
      }
    });

    test("rejects CSS SSRF end-to-end through render()", async () => {
      const attacks = [
        `<div style={{ display: "flex", backgroundImage: "url('http://127.0.0.1:8080/admin')" }}><span>Attack</span></div>`,
        `<div style={{ display: "flex", background: "url(https://internal/token)" }}><span>Attack</span></div>`,
        `<div style={{ display: "flex", maskImage: "url(//evil.com/leak)" }}><span>Attack</span></div>`,
      ];

      for (const jsx of attacks) {
        try {
          await render(jsx, { width: 300, height: 150 });
          expect().fail(`Expected render rejection for: ${jsx}`);
        } catch (err) {
          expect(err instanceof RenderError).toBe(true);
          expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
        }
      }
    });
  });

  describe("Criterion 2: Relative and filesystem reads without baseDir blocked", () => {
    test("validateAssetSource rejects local paths when baseDir is undefined", () => {
      const localPaths = [
        "relative/path/to/image.png",
        "./image.png",
        "../parent.png",
        "/absolute/root/image.png",
        "fixtures/artifacts/sample-card.png",
        "package.json",
      ];

      for (const path of localPaths) {
        expect(() => validateAssetSource(path, undefined)).toThrow(RenderError);
        try {
          validateAssetSource(path, undefined);
        } catch (err) {
          expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
          expect((err as RenderError).message).toContain(
            "not permitted without base directory",
          );
        }
      }
    });

    test("resolveAssetToDataUri rejects local paths without baseDir", async () => {
      try {
        await resolveAssetToDataUri("fixtures/artifacts/sample-card.png");
        expect().fail("Expected error when baseDir is omitted");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
      }
    });

    test("only data:image is permitted without baseDir", async () => {
      const dataUri =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
      const validated = validateAssetSource(dataUri, undefined);
      expect(validated).toBe(dataUri);

      const resolved = await resolveAssetToDataUri(dataUri, undefined);
      expect(resolved).toBe(dataUri);
    });

    test("render() rejects local images when baseDir option is omitted", async () => {
      const jsx = `<div style={{ display: "flex" }}><img src="fixtures/artifacts/sample-card.png" width={100} height={100} /></div>`;
      try {
        await render(jsx, { width: 300, height: 150 });
        expect().fail("Expected render failure without baseDir");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
      }
    });

    test("render() succeeds with local image when valid baseDir is supplied", async () => {
      const jsx = `<div style={{ display: "flex" }}><img src="artifacts/sample-card.png" width={50} height={50} /></div>`;
      const result = await render(jsx, {
        width: 100,
        height: 100,
        baseDir: fixturesDir,
      });
      expect(result.png.byteLength).toBeGreaterThan(0);
      expect(result.svg.includes("<svg")).toBe(true);
    });
  });

  describe("Criterion 3: Non-image file extensions blocked", () => {
    test("rejects non-image extensions even when within valid baseDir", () => {
      const disallowedFiles = [
        "config.json",
        "secret.txt",
        "source.jsx",
        "component.tsx",
        "script.sh",
        "style.css",
        "index.html",
        "payload.exe",
        "archive.zip",
        "document.pdf",
        "binary.wasm",
        "no-extension",
        ".env",
        ".gitignore",
      ];

      for (const file of disallowedFiles) {
        expect(() => validateAssetSource(file, fixturesDir)).toThrow(
          RenderError,
        );
        try {
          validateAssetSource(file, fixturesDir);
        } catch (err) {
          expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
          expect((err as RenderError).message).toContain("Disallowed asset");
        }
      }
    });

    test("permits supported image extensions case-insensitively with baseDir", () => {
      const allowedCases = [
        "sample-card.png",
        "sample-card.PNG",
        "sample-card.jpg",
        "sample-card.JPG",
        "sample-card.jpeg",
        "sample-card.svg",
        "sample-card.webp",
        "sample-card.gif",
      ];

      for (const file of allowedCases) {
        const validated = validateAssetSource(`artifacts/${file}`, fixturesDir);
        expect(validated.startsWith(fixturesDir)).toBe(true);
      }
    });

    test("rejects double-extension masquerade attempts", () => {
      const trickyPaths = [
        "artifacts/sample.png.exe",
        "artifacts/sample.jpg.sh",
        "artifacts/sample.svg.js",
      ];

      for (const p of trickyPaths) {
        expect(() => validateAssetSource(p, fixturesDir)).toThrow(RenderError);
      }
    });
  });

  describe("Criterion 4: Malformed JSX rejected via parseDiagnostics", () => {
    test("rejects unclosed and truncated JSX tags with UNSUPPORTED_SYNTAX", () => {
      const malformedExamples = [
        "<div><span",
        "<div><span>",
        "<div><span attr=",
        "<div><img",
        "<div style={{",
        "<div style={{ display: 'flex' }",
        "<div><span></div>",
        "<div><",
        "<div>{ 1 + }</div>",
        "<div className=></div>",
      ];

      for (const snippet of malformedExamples) {
        expect(() => validateJsx(snippet)).toThrow(RenderError);
        try {
          validateJsx(snippet);
        } catch (err) {
          expect((err as RenderError).code).toBe("UNSUPPORTED_SYNTAX");
          expect((err as RenderError).message).toContain("JSX syntax error");
        }
      }
    });

    test("render() surfaces UNSUPPORTED_SYNTAX for malformed JSX input", async () => {
      const brokenJsx = ["<div><span>Unclosed", "<div style={{ display:"];

      for (const code of brokenJsx) {
        try {
          await render(code, { width: 300, height: 150 });
          expect().fail(`Expected render failure for: ${code}`);
        } catch (err) {
          expect(err instanceof RenderError).toBe(true);
          expect((err as RenderError).code).toBe("UNSUPPORTED_SYNTAX");
        }
      }
    });
  });

  describe("Criterion 5: URI schemes other than data:image rejected", () => {
    test("isDisallowedRemoteUrl correctly identifies disallowed schemes", () => {
      const disallowedUrls = [
        "http://example.com/test.png",
        "https://example.com/test.png",
        "ftp://example.com/test.png",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "gopher://localhost:70",
        "ws://localhost:8080",
        "wss://secure.host",
        "ldap://localhost:389",
        "blob:http://localhost/uuid",
        "about:blank",
        "data:text/html;base64,PHNjcmlwdD4=",
        "data:application/json;base64,{}",
        "data:application/octet-stream;base64,AAAA",
        "//cdn.example.com/image.png",
        "HTTP://UPPERCASE.COM/IMG.PNG",
        "JAVASCRIPT:VOID(0)",
        "DATA:TEXT/HTML,hello",
      ];

      for (const url of disallowedUrls) {
        expect(isDisallowedRemoteUrl(url)).toBe(true);
      }
    });

    test("isDataImageUrl only accepts data:image/ scheme", () => {
      expect(
        isDataImageUrl(
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        ),
      ).toBe(true);
      expect(isDataImageUrl("DATA:IMAGE/JPEG;base64,...")).toBe(true);
      expect(isDataImageUrl("data:image/svg+xml;utf8,<svg></svg>")).toBe(true);
      expect(isDataImageUrl("data:text/html;base64,...")).toBe(false);
      expect(isDataImageUrl("data:application/pdf;base64,...")).toBe(false);
      expect(isDataImageUrl("https://image.png")).toBe(false);
    });

    test("validateAssetSource rejects non-image schemes even if baseDir is set", () => {
      const nonImageUrls = [
        "http://example.com/pic.png",
        "javascript:alert(1)",
        "file:///etc/hosts",
        "data:text/plain;base64,SGVsbG8=",
        "blob:http://localhost:3000/uuid",
        "//evil.com/pic.png",
      ];

      for (const url of nonImageUrls) {
        expect(() => validateAssetSource(url, fixturesDir)).toThrow(
          RenderError,
        );
        try {
          validateAssetSource(url, fixturesDir);
        } catch (err) {
          expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
        }
      }
    });

    test("validateJsx rejects non-image schemes in img src attributes", () => {
      const nonImageElements = [
        '<div><img src="http://example.com/leak.png" /></div>',
        '<div><img src="blob:http://localhost/xyz" /></div>',
        '<div><img src="data:text/html;base64,abc" /></div>',
        '<div><img src="//cdn.example.com/leak.png" /></div>',
      ];

      for (const code of nonImageElements) {
        expect(() => validateJsx(code, { baseDir: fixturesDir })).toThrow(
          RenderError,
        );
      }
    });
  });
});
