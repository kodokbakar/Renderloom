import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RenderError } from "../../src/domain/errors";
import {
  clearFontCache,
  getDefaultFontConfig,
  getDefaultFontConfigs,
  getSymbolFontConfig,
  loadBundledFont,
} from "../../src/renderer/fonts";
import { readPngDimensions, verifyPngDimensions } from "../../src/renderer/png";
import {
  clearEmojiCache,
  loadLocalEmoji,
  render,
} from "../../src/renderer/render";

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

  test("renders heading elements h1 through h6 to SVG and PNG", async () => {
    const jsx = `
      <div style={{ display: "flex", flexDirection: "column", width: 600, height: 400, backgroundColor: "#ffffff" }}>
        <h1 style={{ fontSize: 32, color: "#111827" }}>Title 1</h1>
        <h2 style={{ fontSize: 24, color: "#374151" }}>Title 2</h2>
        <h3 style={{ fontSize: 20, color: "#4b5563" }}>Title 3</h3>
        <h4 style={{ fontSize: 16, color: "#6b7280" }}>Title 4</h4>
        <h5 style={{ fontSize: 14, color: "#9ca3af" }}>Title 5</h5>
        <h6 style={{ fontSize: 12, color: "#d1d5db" }}>Title 6</h6>
      </div>
    `;

    const result = await render(jsx, { width: 600, height: 400 });
    expect(result.width).toBe(600);
    expect(result.height).toBe(400);
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain('width="600"');
    expect(result.svg).toContain('height="400"');
    expect(result.svg).toContain("<path");
    expect(result.svg).toContain("#111827");
    expect(result.svg).toContain("#d1d5db");
    expect(Buffer.isBuffer(result.png)).toBe(true);
    expect(result.png.length).toBeGreaterThan(100);
  });

  test("renders JSX with <br/> and unclosed <br> tags properly", async () => {
    const jsx = `
      <div style={{ display: "flex", flexDirection: "column", width: 500, height: 300, backgroundColor: "#ffffff", padding: 20 }}>
        <p style={{ fontSize: 18, color: "#111827" }}>
          Line 1<br/>Line 2<br>Line 3
        </p>
      </div>
    `;

    const result = await render(jsx, { width: 500, height: 300 });
    expect(result.width).toBe(500);
    expect(result.height).toBe(300);
    expect(result.svg).toContain("<svg");
    expect(Buffer.isBuffer(result.png)).toBe(true);
    expect(result.png.length).toBeGreaterThan(100);
  });

  test("renders deeply nested heading hierarchy with complex styling to valid SVG and PNG", async () => {
    const jsx = `
      <div style={{ display: "flex", flexDirection: "column", width: 800, height: 600, backgroundColor: "#0f172a", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: 36, color: "#f8fafc", margin: 0, letterSpacing: "-0.01em" }}>
            Hero <span style={{ color: "#38bdf8" }}>Title</span>
          </h1>
          <h2 style={{ fontSize: 20, color: "#94a3b8", margin: 0 }}>Subtitle</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
          <h3 style={{ fontSize: 18, color: "#cbd5e1" }}>Nested Section</h3>
          <div style={{ display: "flex", gap: 16 }}>
            <h4 style={{ fontSize: 16, color: "#e2e8f0" }}>Item A</h4>
            <h5 style={{ fontSize: 14, color: "#64748b" }}>Item B</h5>
            <h6 style={{ fontSize: 12, color: "#475569" }}>Item C</h6>
          </div>
        </div>
      </div>
    `;

    const result = await render(jsx, { width: 800, height: 600 });
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain('width="800"');
    expect(result.svg).toContain('height="600"');
    expect(result.svg).toContain("#38bdf8");
    expect(result.svg).toContain("#0f172a");
    expect(Buffer.isBuffer(result.png)).toBe(true);
    const dims = readPngDimensions(result.png);
    expect(dims.width).toBe(800);
    expect(dims.height).toBe(600);
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

    test("loads and caches Noto Sans Symbols font and default configs", async () => {
      clearFontCache();
      const symbolFont = await getSymbolFontConfig();
      expect(symbolFont.name).toBe("Noto Sans Symbols");
      expect(symbolFont.data.byteLength).toBeGreaterThan(100000);

      const configs = await getDefaultFontConfigs();
      expect(configs).toHaveLength(2);
      expect(configs[0]?.name).toBe("Roboto");
      expect(configs[1]?.name).toBe("Noto Sans Symbols");
      expect(configs[1]?.data).toBe(symbolFont.data);
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

  describe("Unicode Symbols and Emojis Support", () => {
    test("renders Unicode symbols (→, ←, ★, ✓, ✦, ⚡) without .notdef tofu glyphs", async () => {
      const jsx = `
        <div style={{ display: "flex", width: 400, height: 100, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 24, color: "#111827" }}>→ ← ★ ✓ ✦ ⚡</span>
        </div>
      `;

      const result = await render(jsx, { width: 400, height: 100 });
      expect(result.width).toBe(400);
      expect(result.height).toBe(100);

      // Verify no Roboto .notdef tofu glyph path signature
      expect(result.svg.includes("M1 2.6L6.1 2.6")).toBe(false);
      expect(result.svg).toContain("<path");

      // Verify valid PNG rasterization
      expect(Buffer.isBuffer(result.png)).toBe(true);
      expect(result.png.subarray(0, 8).toString("hex")).toBe(PNG_MAGIC_HEX);
      const dims = readPngDimensions(result.png);
      expect(dims.width).toBe(400);
      expect(dims.height).toBe(100);
    });

    test("renders standard emojis (🚀, ✨, 🔥, 💡) as inline SVG images", async () => {
      const jsx = `
        <div style={{ display: "flex", width: 500, height: 120, backgroundColor: "#1e1e2e", padding: 20 }}>
          <span style={{ fontSize: 32 }}>🚀 ✨ 🔥 💡</span>
        </div>
      `;

      const result = await render(jsx, { width: 500, height: 120 });
      expect(result.svg).toContain("<image");
      expect(result.svg).toContain("data:image/svg+xml;base64,");

      expect(Buffer.isBuffer(result.png)).toBe(true);
      expect(result.png.subarray(0, 8).toString("hex")).toBe(PNG_MAGIC_HEX);
      const dims = readPngDimensions(result.png);
      expect(dims.width).toBe(500);
      expect(dims.height).toBe(120);
    });

    test("renders compound emojis with ZWJ and modifiers (👨‍💻, 👍🏽)", async () => {
      const jsx = `
        <div style={{ display: "flex", width: 400, height: 100, backgroundColor: "#ffffff" }}>
          <span style={{ fontSize: 28 }}>👨‍💻 👍🏽</span>
        </div>
      `;

      const result = await render(jsx, { width: 400, height: 100 });
      expect(result.svg).toContain("<image");
      expect(result.svg).toContain("data:image/svg+xml;base64,");

      expect(Buffer.isBuffer(result.png)).toBe(true);
      expect(result.png.subarray(0, 8).toString("hex")).toBe(PNG_MAGIC_HEX);
    });

    test("handles mixed JSX tree with text, symbols, and emojis", async () => {
      const jsx = `
        <div style={{ display: "flex", flexDirection: "column", width: 600, height: 300, backgroundColor: "#0f172a", padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 28, color: "#38bdf8", marginRight: 8 }}>✦</span>
            <span style={{ fontSize: 24, color: "#ffffff", fontWeight: 700 }}>Renderloom Feature Card 🚀</span>
          </div>
          <div style={{ display: "flex", marginTop: 16 }}>
            <span style={{ fontSize: 18, color: "#94a3b8" }}>Status: Active ✓ | Fast ⚡ | High Quality ★</span>
          </div>
        </div>
      `;

      const result = await render(jsx, { width: 600, height: 300 });
      expect(result.svg.includes("M1 2.6L6.1 2.6")).toBe(false);
      expect(result.svg).toContain("<image");
      expect(result.svg).toContain("<path");

      expect(Buffer.isBuffer(result.png)).toBe(true);
      const dims = readPngDimensions(result.png);
      expect(dims.width).toBe(600);
      expect(dims.height).toBe(300);
    });

    test("handles unknown or unsupported emojis gracefully", async () => {
      const unknownChar = String.fromCodePoint(0x1f999);
      const jsx = `
        <div style={{ display: "flex", width: 300, height: 100 }}>
          <span>Unknown: ${unknownChar}</span>
        </div>
      `;

      const result = await render(jsx, { width: 300, height: 100 });
      expect(result.width).toBe(300);
      expect(result.height).toBe(100);
      expect(Buffer.isBuffer(result.png)).toBe(true);
    });

    test("prevents directory traversal attacks via emoji segment", async () => {
      const attacks = [
        "../package.json",
        "../../etc/passwd",
        "../../",
        "invalid/segment",
        "123456789",
        "../node_modules",
      ];

      for (const attack of attacks) {
        const resolved = await loadLocalEmoji(attack);
        expect(resolved).toBeUndefined();
      }
    });

    test("caches font buffers and emoji assets in memory", async () => {
      clearEmojiCache();
      const emoji1 = await loadLocalEmoji("🚀");
      expect(emoji1).toBeDefined();
      expect(typeof emoji1).toBe("string");

      // Verify cached reference is returned
      const emoji2 = await loadLocalEmoji("🚀");
      expect(emoji2).toBe(emoji1);

      clearEmojiCache();
      const emoji3 = await loadLocalEmoji("🚀");
      expect(emoji3).toBe(emoji1);

      clearFontCache();
      const [f1] = await getDefaultFontConfigs();
      const [f2] = await getDefaultFontConfigs();
      expect(f1?.data).toBe(f2?.data);
    });
  });
});
