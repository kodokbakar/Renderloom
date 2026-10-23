import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RenderError } from "../../src/domain/errors";
import {
  clearFontCache,
  getDefaultFontConfig,
  loadBundledFont,
} from "../../src/renderer/fonts";
import { readPngDimensions, verifyPngDimensions } from "../../src/renderer/png";
import { render } from "../../src/renderer/render";

const PNG_MAGIC_HEX = "89504e470d0a1a0a";

describe("Core Renderer Engine", () => {
  test("renders valid static JSX fixture to SVG and PNG", async () => {
    const fixturePath = resolve(import.meta.dir, "../fixtures/sample-card.jsx");
    const jsxSource = await readFile(fixturePath, "utf-8");

    const result = await render(jsxSource, { width: 600, height: 400 });

    expect(result.width).toBe(600);
    expect(result.height).toBe(400);

    // SVG checks
    expect(typeof result.svg).toBe("string");
    expect(result.svg.startsWith("<svg")).toBe(true);
    expect(result.svg.includes('width="600"')).toBe(true);
    expect(result.svg.includes('height="400"')).toBe(true);
    expect(result.svg.includes('viewBox="0 0 600 400"')).toBe(true);
    expect(result.svg.includes("<path")).toBe(true);

    // PNG checks
    expect(Buffer.isBuffer(result.png)).toBe(true);
    expect(result.png.length).toBeGreaterThan(1000);
    const magic = result.png.subarray(0, 8).toString("hex");
    expect(magic).toBe(PNG_MAGIC_HEX);

    const dims = readPngDimensions(result.png);
    expect(dims.width).toBe(600);
    expect(dims.height).toBe(400);
  });

  test("renders with custom square dimensions (1080x1080)", async () => {
    const jsx = `
      <div style={{ display: "flex", width: 1080, height: 1080, backgroundColor: "#3b82f6", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 48, color: "white" }}>Square Poster</span>
      </div>
    `;

    const result = await render(jsx, { width: 1080, height: 1080 });
    expect(result.width).toBe(1080);
    expect(result.height).toBe(1080);

    const dims = readPngDimensions(result.png);
    expect(dims.width).toBe(1080);
    expect(dims.height).toBe(1080);
  });

  test("rejects invalid dimensions", async () => {
    const jsx = `<div style={{ display: "flex" }}>Hello</div>`;

    await expect(render(jsx, { width: 0, height: 100 })).rejects.toThrow(
      RenderError,
    );
    await expect(render(jsx, { width: 100, height: -50 })).rejects.toThrow(
      RenderError,
    );
    await expect(
      render(jsx, { width: Number.NaN, height: 100 }),
    ).rejects.toThrow(RenderError);
    await expect(
      render(jsx, { width: Number.POSITIVE_INFINITY, height: 100 }),
    ).rejects.toThrow(RenderError);
    await expect(
      render(jsx, { width: 100, height: Number.NEGATIVE_INFINITY }),
    ).rejects.toThrow(RenderError);
  });

  test("rounds floating-point dimensions cleanly", async () => {
    const jsx = `<div style={{ display: "flex", width: "100%", height: "100%" }}>Rounded</div>`;
    const result = await render(jsx, { width: 200.4, height: 100.6 });
    expect(result.width).toBe(200);
    expect(result.height).toBe(101);
    const dims = readPngDimensions(result.png);
    expect(dims.width).toBe(200);
    expect(dims.height).toBe(101);
  });
  test("returns structured RenderError for malicious syntax without evaluating", async () => {
    const maliciousSources = [
      `<div onClick={() => eval("alert(1)")}>Click</div>`,
      "<div><script>alert(1)</script></div>",
      `<div style={{ color: eval("red") }}>Hello</div>`,
      `<div><img src="https://evil.com/leak.png" /></div>`,
      `<div style={{ display: "flex", backgroundImage: "url(http://evil.com/leak.png)" }}>SSRF</div>`,
      `<div style={{ display: "flex" }}><img src="package.json" width={100} height={100} /></div>`,
      "<div><span",
    ];
    for (const source of maliciousSources) {
      try {
        await render(source, { width: 400, height: 200 });
        expect().fail(`Expected rejection for source: ${source}`);
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
      }
    }
  });

  test("rejects SSRF via CSS url(...) in style attributes", async () => {
    const jsx = `<div style={{ display: "flex", backgroundImage: "url(http://evil.com/leak.png)" }}>SSRF</div>`;
    try {
      await render(jsx, { width: 400, height: 200 });
      expect().fail("Expected SSRF rejection");
    } catch (err) {
      expect(err instanceof RenderError).toBe(true);
      expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
    }
  });

  test("rejects relative filesystem paths without baseDir", async () => {
    const jsx = `<div style={{ display: "flex" }}><img src="package.json" width={100} height={100} /></div>`;
    try {
      await render(jsx, { width: 400, height: 200 });
      expect().fail(
        "Expected rejection for relative file read without baseDir",
      );
    } catch (err) {
      expect(err instanceof RenderError).toBe(true);
      expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
    }
  });

  test("rejects malformed JSX with UNSUPPORTED_SYNTAX", async () => {
    try {
      await render("<div><span", { width: 400, height: 200 });
      expect().fail("Expected syntax error rejection");
    } catch (err) {
      expect(err instanceof RenderError).toBe(true);
      expect((err as RenderError).code).toBe("UNSUPPORTED_SYNTAX");
    }
  });

  describe("Font Loader & Caching", () => {
    test("loads and caches bundled OFL font", async () => {
      clearFontCache();
      const font = await getDefaultFontConfig();
      expect(font.name).toBe("Roboto");
      expect(font.data.byteLength).toBeGreaterThan(50000);

      // Subsequent call returns cached buffer
      const font2 = await getDefaultFontConfig();
      expect(font2.data).toBe(font.data);
    });

    test("fails gracefully when font file does not exist", async () => {
      try {
        await loadBundledFont("/nonexistent/font.ttf");
        expect().fail("Expected font loading error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("RENDER_FAILED");
      }
    });
  });

  describe("PNG Header Verification", () => {
    test("throws RENDER_FAILED on invalid PNG magic bytes", () => {
      const corrupt = Buffer.from([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 24,
      ]);
      expect(() => readPngDimensions(corrupt)).toThrow(RenderError);
      try {
        readPngDimensions(corrupt);
      } catch (err) {
        expect((err as RenderError).code).toBe("RENDER_FAILED");
      }
    });

    test("throws RENDER_FAILED on dimension mismatch", () => {
      const validHeader = Buffer.alloc(24);
      validHeader.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      validHeader.set([0x00, 0x00, 0x00, 0x0d], 8);
      validHeader.set([0x49, 0x48, 0x44, 0x52], 12);
      validHeader.writeUInt32BE(400, 16);
      validHeader.writeUInt32BE(300, 20);

      expect(() => verifyPngDimensions(validHeader, 500, 300)).toThrow(
        RenderError,
      );
    });

    test("throws RENDER_FAILED on buffer shorter than 24 bytes", () => {
      const tooShort = Buffer.alloc(20);
      expect(() => readPngDimensions(tooShort)).toThrow(RenderError);
      try {
        readPngDimensions(tooShort);
      } catch (err) {
        expect((err as RenderError).code).toBe("RENDER_FAILED");
        expect((err as RenderError).message).toContain("too small");
      }
    });

    test("throws RENDER_FAILED on missing or incorrect IHDR chunk", () => {
      const badChunk = Buffer.alloc(24);
      badChunk.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      badChunk.set([0x00, 0x00, 0x00, 0x0d], 8);
      badChunk.set([0x49, 0x44, 0x41, 0x54], 12); // IDAT instead of IHDR
      expect(() => readPngDimensions(badChunk)).toThrow(RenderError);
      try {
        readPngDimensions(badChunk);
      } catch (err) {
        expect((err as RenderError).code).toBe("RENDER_FAILED");
        expect((err as RenderError).message).toContain(
          "missing or misplaced IHDR chunk",
        );
      }
    });

    test("throws RENDER_FAILED on zero dimensions in IHDR chunk", () => {
      const zeroDim = Buffer.alloc(24);
      zeroDim.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      zeroDim.set([0x00, 0x00, 0x00, 0x0d], 8);
      zeroDim.set([0x49, 0x48, 0x44, 0x52], 12);
      zeroDim.writeUInt32BE(0, 16);
      zeroDim.writeUInt32BE(100, 20);

      expect(() => readPngDimensions(zeroDim)).toThrow(RenderError);
      try {
        readPngDimensions(zeroDim);
      } catch (err) {
        expect((err as RenderError).code).toBe("RENDER_FAILED");
        expect((err as RenderError).message).toContain(
          "dimensions cannot be zero",
        );
      }
    });
  });
});
