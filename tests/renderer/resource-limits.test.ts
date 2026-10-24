import { describe, expect, spyOn, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import * as satoriModule from "satori";
import {
  MAX_ASSET_BYTES,
  MAX_AST_DEPTH,
  MAX_AST_NODES,
  MAX_RENDER_DURATION_MS,
  MAX_SVG_BYTES,
} from "../../src/domain/dimensions";
import { RenderError } from "../../src/domain/errors";
import {
  resolveAssetToDataUri,
  validateAssetSource,
} from "../../src/renderer/assets";
import { render, renderVNode } from "../../src/renderer/render";
import type { VNode } from "../../src/renderer/types";
import { validateJsx } from "../../src/renderer/validator";

describe("Renderer Resource Limits and Security Guards", () => {
  describe("Resource Limit Constants", () => {
    test("defines expected bounds for safety", () => {
      expect(MAX_ASSET_BYTES).toBe(5_242_880);
      expect(MAX_SVG_BYTES).toBe(10_485_760);
      expect(MAX_RENDER_DURATION_MS).toBe(30_000);
      expect(MAX_AST_DEPTH).toBe(64);
      expect(MAX_AST_NODES).toBe(2000);
    });
  });

  describe("Asset Byte Limits", () => {
    test("accepts data URLs within MAX_ASSET_BYTES", () => {
      const smallDataUri =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      expect(() => validateAssetSource(smallDataUri)).not.toThrow();
    });

    test("rejects data URLs exceeding MAX_ASSET_BYTES", () => {
      // 5MB + 100 bytes of base64
      const oversizeBase64 = "A".repeat(
        Math.ceil(((MAX_ASSET_BYTES + 100) * 4) / 3),
      );
      const oversizeDataUri = `data:image/png;base64,${oversizeBase64}`;

      expect(() => validateAssetSource(oversizeDataUri)).toThrow(RenderError);
      try {
        validateAssetSource(oversizeDataUri);
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        const renderErr = err as RenderError;
        expect(renderErr.code).toBe("UNTRUSTED_REMOTE_ASSET");
        expect(renderErr.message).toContain(
          "Data URI asset exceeds maximum allowed size",
        );
      }
    });

    test("rejects filesystem asset exceeding MAX_ASSET_BYTES during resolution", async () => {
      const tempDir = await mkdtemp(
        path.join(tmpdir(), "renderloom-asset-limit-"),
      );
      try {
        const largeFile = path.join(tempDir, "oversize.png");
        const largeBuffer = Buffer.alloc(MAX_ASSET_BYTES + 1024);
        await writeFile(largeFile, largeBuffer);

        await expect(
          resolveAssetToDataUri("oversize.png", tempDir),
        ).rejects.toThrow(RenderError);
        try {
          await resolveAssetToDataUri("oversize.png", tempDir);
        } catch (err) {
          expect(err instanceof RenderError).toBe(true);
          const renderErr = err as RenderError;
          expect(renderErr.code).toBe("UNTRUSTED_REMOTE_ASSET");
          expect(renderErr.message).toContain(
            "Asset file exceeds maximum allowed size",
          );
        }
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("AST Depth Limits", () => {
    test("accepts normal nesting depth", () => {
      const validJsx = `
        <div style={{ display: "flex" }}>
          <div>
            <div>
              <span>Nested Text</span>
            </div>
          </div>
        </div>
      `;
      expect(() => validateJsx(validJsx)).not.toThrow();
    });

    test("rejects AST recursion depth bomb exceeding MAX_AST_DEPTH", () => {
      // Nest divs 70 levels deep (exceeding MAX_AST_DEPTH of 64)
      let bomb = "<span>Deep</span>";
      for (let i = 0; i < 70; i++) {
        bomb = `<div>${bomb}</div>`;
      }

      expect(() => validateJsx(bomb)).toThrow(RenderError);
      try {
        validateJsx(bomb);
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        const renderErr = err as RenderError;
        expect(renderErr.code).toBe("UNSUPPORTED_SYNTAX");
        expect(renderErr.message).toContain(
          "AST depth exceeds maximum allowed depth",
        );
      }
    });
  });

  describe("AST Node Count Limits", () => {
    test("rejects oversized AST exceeding MAX_AST_NODES", () => {
      // Generate 2500 sibling spans in root div
      const spans: string[] = [];
      for (let i = 0; i < 2500; i++) {
        spans.push(`<span>${i}</span>`);
      }
      const nodeBomb = `<div>${spans.join("")}</div>`;

      expect(() => validateJsx(nodeBomb)).toThrow(RenderError);
      try {
        validateJsx(nodeBomb);
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        const renderErr = err as RenderError;
        expect(renderErr.code).toBe("UNSUPPORTED_SYNTAX");
        expect(renderErr.message).toContain(
          "AST node count exceeds maximum allowed limit",
        );
      }
    });
  });

  describe("Prototype Pollution Guards", () => {
    test("rejects __proto__ as attribute name", () => {
      const hostile = `<div __proto__="polluted">Content</div>`;
      expect(() => validateJsx(hostile)).toThrow(RenderError);
      try {
        validateJsx(hostile);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Prohibited attribute name: __proto__",
        );
      }
    });

    test("rejects constructor as attribute name", () => {
      const hostile = `<div constructor="polluted">Content</div>`;
      expect(() => validateJsx(hostile)).toThrow(RenderError);
      try {
        validateJsx(hostile);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Prohibited attribute name: constructor",
        );
      }
    });

    test("rejects prototype as attribute name", () => {
      const hostile = `<div prototype="polluted">Content</div>`;
      expect(() => validateJsx(hostile)).toThrow(RenderError);
      try {
        validateJsx(hostile);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Prohibited attribute name: prototype",
        );
      }
    });

    test("rejects __proto__ in style object", () => {
      const hostile = `<div style={{ __proto__: "polluted" }}>Content</div>`;
      expect(() => validateJsx(hostile)).toThrow(RenderError);
      try {
        validateJsx(hostile);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Prohibited property in style object: __proto__",
        );
      }
    });

    test("rejects constructor in style object", () => {
      const hostile = `<div style={{ constructor: "polluted" }}>Content</div>`;
      expect(() => validateJsx(hostile)).toThrow(RenderError);
      try {
        validateJsx(hostile);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Prohibited property in style object: constructor",
        );
      }
    });

    test("rejects prototype in style object", () => {
      const hostile = `<div style={{ prototype: "polluted" }}>Content</div>`;
      expect(() => validateJsx(hostile)).toThrow(RenderError);
      try {
        validateJsx(hostile);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Prohibited property in style object: prototype",
        );
      }
    });
  });

  describe("Render Timeout Enforcement", () => {
    test("throws RENDER_FAILED when layout exceeds timeoutMs", async () => {
      // Integration test exercising timer expiration for renderer timeout handling
      const neverResolving = new Promise<string>(() => {});
      const spy = spyOn(satoriModule, "default").mockReturnValue(
        neverResolving as unknown as Promise<string>,
      );

      try {
        const dummyVNode: VNode = {
          type: "div",
          props: {
            style: { display: "flex", width: "100%", height: "100%" },
            children: "Timeout Test",
          },
        };

        await expect(
          renderVNode(dummyVNode, {
            width: 100,
            height: 100,
            timeoutMs: 1,
          }),
        ).rejects.toThrow(RenderError);

        try {
          await renderVNode(dummyVNode, {
            width: 100,
            height: 100,
            timeoutMs: 1,
          });
        } catch (err) {
          expect(err instanceof RenderError).toBe(true);
          const renderErr = err as RenderError;
          expect(renderErr.code).toBe("RENDER_FAILED");
          expect(renderErr.message).toContain(
            "Render duration exceeded timeout",
          );
        }
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe("SVG Byte Size Limit", () => {
    test("accepts normal SVG payload under MAX_SVG_BYTES", async () => {
      const dummyVNode: VNode = {
        type: "div",
        props: {
          style: {
            display: "flex",
            width: "100%",
            height: "100%",
            backgroundColor: "#fff",
          },
          children: "Hello World",
        },
      };

      const result = await renderVNode(dummyVNode, { width: 100, height: 100 });
      expect(result.svg).toBeDefined();
      expect(Buffer.byteLength(result.svg, "utf8")).toBeLessThanOrEqual(
        MAX_SVG_BYTES,
      );
    });

    test("rejects SVG payload exceeding MAX_SVG_BYTES", async () => {
      const oversizeSvg = `<svg>${"A".repeat(MAX_SVG_BYTES + 512)}</svg>`;
      const spy = spyOn(satoriModule, "default").mockImplementation(
        async () => oversizeSvg,
      );

      try {
        const dummyVNode: VNode = {
          type: "div",
          props: {
            style: { display: "flex", width: "100%", height: "100%" },
            children: "Oversize SVG",
          },
        };

        await expect(
          renderVNode(dummyVNode, { width: 100, height: 100 }),
        ).rejects.toThrow(RenderError);

        try {
          await renderVNode(dummyVNode, { width: 100, height: 100 });
        } catch (err) {
          expect(err instanceof RenderError).toBe(true);
          const renderErr = err as RenderError;
          expect(renderErr.code).toBe("RENDER_FAILED");
          expect(renderErr.message).toContain(
            "Generated SVG size exceeds maximum allowed size",
          );
        }
      } finally {
        spy.mockRestore();
      }
    });
  });
});
