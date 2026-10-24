import { describe, expect, test } from "bun:test";
import { RenderError } from "../../src/domain/errors";
import { interpretJsx } from "../../src/renderer/interpreter";
import { render } from "../../src/renderer/render";
import { validateJsx } from "../../src/renderer/validator";

describe("Malicious Source Penetration Test Suite", () => {
  describe("Import Vectors", () => {
    test("rejects static imports", () => {
      const code = `import fs from "node:fs"; <div>Hello</div>`;
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Import statements are not allowed",
        );
      }
    });

    test("rejects require() calls in JSX expressions", () => {
      const code = `<div>{require("node:fs")}</div>`;
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Function calls in JSX children are not allowed",
        );
      }
    });

    test("rejects dynamic import() calls in JSX expressions", () => {
      const code = `<div>{import("node:fs")}</div>`;
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });
  });

  describe("Execution Keywords and Function Constructors", () => {
    test("rejects eval() in child expression", () => {
      const code = `<div>{eval("2 + 2")}</div>`;
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Function calls in JSX children are not allowed",
        );
      }
    });

    test("rejects Function constructor calls", () => {
      const code = `<div>{Function("return process")()}</div>`;
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects setTimeout and setInterval in expressions", () => {
      const code1 = "<div>{setTimeout(() => {}, 100)}</div>";
      const code2 = "<div>{setInterval(() => {}, 100)}</div>";
      expect(() => validateJsx(code1)).toThrow(RenderError);
      expect(() => validateJsx(code2)).toThrow(RenderError);
    });

    test("rejects global identifiers in expressions (globalThis, window, process)", () => {
      const code1 = "<div>{globalThis}</div>";
      const code2 = "<div>{window}</div>";
      const code3 = "<div>{process}</div>";

      expect(() => validateJsx(code1)).toThrow(RenderError);
      expect(() => validateJsx(code2)).toThrow(RenderError);
      expect(() => validateJsx(code3)).toThrow(RenderError);

      try {
        validateJsx(code1);
      } catch (err) {
        expect((err as RenderError).code).toBe("UNSUPPORTED_SYNTAX");
        expect((err as RenderError).message).toContain(
          "Dynamic variables or identifiers in JSX children are not allowed",
        );
      }
    });

    test("rejects function calls in style properties", () => {
      const code = `<div style={{ color: eval("red") }}>Hello</div>`;
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Function calls in styles are not allowed",
        );
      }
    });

    test("rejects function calls in attributes", () => {
      const code = `<div title={eval("x")}>Hello</div>`;
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Function calls in attributes are not allowed",
        );
      }
    });
  });

  describe("Prototype Pollution Vectors", () => {
    test("rejects __proto__ as attribute", () => {
      const code = "<div __proto__={{ polluted: true }}>Hello</div>";
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Prohibited attribute name: __proto__",
        );
      }
    });

    test("rejects constructor as attribute", () => {
      const code = `<div constructor="bad">Hello</div>`;
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Prohibited attribute name: constructor",
        );
      }
    });

    test("rejects prototype as attribute", () => {
      const code = `<div prototype="bad">Hello</div>`;
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Prohibited attribute name: prototype",
        );
      }
    });

    test("rejects __proto__ in style object", () => {
      const code = "<div style={{ __proto__: { pollutes: true } }}>Hello</div>";
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Prohibited property in style object: __proto__",
        );
      }
    });

    test("rejects constructor in style object", () => {
      const code = `<div style={{ constructor: "polluted" }}>Hello</div>`;
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Prohibited property in style object: constructor",
        );
      }
    });

    test("rejects prototype in style object", () => {
      const code = `<div style={{ prototype: "polluted" }}>Hello</div>`;
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Prohibited property in style object: prototype",
        );
      }
    });

    test("rejects case variants and quoted keys for prototype pollution", () => {
      expect(() => validateJsx(`<div __Proto__="bad">Hello</div>`)).toThrow(
        RenderError,
      );
      expect(() => validateJsx(`<div CONSTRUCTOR="bad">Hello</div>`)).toThrow(
        RenderError,
      );
      expect(() => validateJsx(`<div ProtoType="bad">Hello</div>`)).toThrow(
        RenderError,
      );
      expect(() => validateJsx(`<div __PROTO__="bad">Hello</div>`)).toThrow(
        RenderError,
      );

      expect(() =>
        validateJsx(`<div style={{ "__proto__": "bad" }}>Hello</div>`),
      ).toThrow(RenderError);
      expect(() =>
        validateJsx(`<div style={{ "__PROTO__": "bad" }}>Hello</div>`),
      ).toThrow(RenderError);
      expect(() =>
        validateJsx(`<div style={{ "CoNsTrUcToR": "bad" }}>Hello</div>`),
      ).toThrow(RenderError);
      expect(() =>
        validateJsx(`<div style={{ "PROTOTYPE": "bad" }}>Hello</div>`),
      ).toThrow(RenderError);

      const protoRec = Object.prototype as Record<string, unknown>;
      expect(protoRec.bad).toBeUndefined();
      expect(protoRec.polluted).toBeUndefined();
    });
  });

  describe("Event Handlers and Case Variations", () => {
    test("rejects onClick, onError, onload, onmouseover handlers", () => {
      expect(() => validateJsx("<div onClick={() => {}}>Hello</div>")).toThrow(
        RenderError,
      );
      expect(() => validateJsx(`<div onError="alert(1)">Hello</div>`)).toThrow(
        RenderError,
      );
      expect(() => validateJsx(`<div onload="alert(1)">Hello</div>`)).toThrow(
        RenderError,
      );
      expect(() =>
        validateJsx(`<div onmouseover="alert(1)">Hello</div>`),
      ).toThrow(RenderError);
    });

    test("rejects mixed-case and uppercase event handler names", () => {
      expect(() => validateJsx(`<div ONCLICK="alert(1)">Hello</div>`)).toThrow(
        RenderError,
      );
      expect(() => validateJsx(`<div oNcLiCk="alert(1)">Hello</div>`)).toThrow(
        RenderError,
      );
      expect(() => validateJsx(`<div ONLOAD="alert(1)">Hello</div>`)).toThrow(
        RenderError,
      );
      expect(() =>
        validateJsx(`<div onAnimationEnd="alert(1)">Hello</div>`),
      ).toThrow(RenderError);
    });

    test("rejects focus, blur, keyboard, and SVG event handlers", () => {
      expect(() => validateJsx("<div onFocus={() => {}}>Hello</div>")).toThrow(
        RenderError,
      );
      expect(() => validateJsx(`<div onBlur="alert(1)">Hello</div>`)).toThrow(
        RenderError,
      );
      expect(() =>
        validateJsx(`<div onKeyDown="alert(1)">Hello</div>`),
      ).toThrow(RenderError);
      expect(() =>
        validateJsx(`<svg onload="alert(1)"><path onclick="alert(2)" /></svg>`),
      ).toThrow(RenderError);
    });
  });

  describe("Dangerous Tags and Embedded Elements", () => {
    test("rejects script, style, iframe, object, embed, link, meta, base tags", () => {
      const tags = [
        "script",
        "style",
        "iframe",
        "object",
        "embed",
        "link",
        "meta",
        "base",
      ];
      for (const tag of tags) {
        const code = `<div><${tag}>evil</${tag}></div>`;
        expect(() => validateJsx(code)).toThrow(RenderError);
        try {
          validateJsx(code);
        } catch (err) {
          expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        }
      }
    });

    test("rejects dangerous tags as self-closing tags", () => {
      const tags = [
        "script",
        "iframe",
        "object",
        "embed",
        "link",
        "meta",
        "base",
      ];
      for (const tag of tags) {
        const code = `<div><${tag} /></div>`;
        expect(() => validateJsx(code)).toThrow(RenderError);
      }
    });

    test("rejects uppercase and mixed-case dangerous tags", () => {
      expect(() => validateJsx("<div><SCRIPT>alert(1)</SCRIPT></div>")).toThrow(
        RenderError,
      );
      expect(() => validateJsx(`<div><IFRAME src="evil" /></div>`)).toThrow(
        RenderError,
      );
      expect(() => validateJsx(`<div><OBJECT data="evil" /></div>`)).toThrow(
        RenderError,
      );
      expect(() => validateJsx(`<div><EMBED src="evil" /></div>`)).toThrow(
        RenderError,
      );
      expect(() =>
        validateJsx("<div><STYLE>body { display: none; }</STYLE></div>"),
      ).toThrow(RenderError);
    });
  });

  describe("Spreads and Dynamic Props", () => {
    test("rejects JSX spread attributes", () => {
      const code = "<div {...props}>Hello</div>";
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "JSX spread attributes ({...props}) are not allowed",
        );
      }
    });

    test("rejects spread assignments in style objects", () => {
      const code = "<div style={{ ...styles }}>Hello</div>";
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain(
          "Spread assignments in style objects are not allowed",
        );
      }
    });
  });

  describe("Dangerous URLs and Protocols", () => {
    test("rejects javascript:, vbscript:, and data:text/html URLs in img src", () => {
      expect(() =>
        validateJsx(
          `<div style={{ display: "flex" }}><img src="javascript:alert(1)" /></div>`,
        ),
      ).toThrow(RenderError);
      expect(() =>
        validateJsx(
          `<div style={{ display: "flex" }}><img src="vbscript:msgbox(1)" /></div>`,
        ),
      ).toThrow(RenderError);
      expect(() =>
        validateJsx(
          `<div style={{ display: "flex" }}><img src="data:text/html;base64,PHNjcmlwdD4=" /></div>`,
        ),
      ).toThrow(RenderError);
    });

    test("rejects remote http, https, and protocol-relative URLs", () => {
      expect(() =>
        validateJsx(
          `<div style={{ display: "flex" }}><img src="http://evil.com/pic.png" /></div>`,
        ),
      ).toThrow(RenderError);
      expect(() =>
        validateJsx(
          `<div style={{ display: "flex" }}><img src="https://evil.com/pic.png" /></div>`,
        ),
      ).toThrow(RenderError);
      expect(() =>
        validateJsx(
          `<div style={{ display: "flex" }}><img src="//evil.com/pic.png" /></div>`,
        ),
      ).toThrow(RenderError);
    });

    test("rejects null byte injections in asset paths", () => {
      expect(() =>
        validateJsx(
          `<div style={{ display: "flex" }}><img src="safe.png\\0evil.png" /></div>`,
        ),
      ).toThrow(RenderError);
      expect(() =>
        validateJsx(
          `<div style={{ display: "flex" }}><img src="safe.png%00evil.png" /></div>`,
        ),
      ).toThrow(RenderError);
    });

    test("rejects remote and script URLs inside CSS url() properties", () => {
      expect(() =>
        validateJsx(
          `<div style={{ backgroundImage: "url('javascript:alert(1)')" }}>Hello</div>`,
        ),
      ).toThrow(RenderError);
      expect(() =>
        validateJsx(
          `<div style={{ backgroundImage: "url('https://evil.com/pic.png')" }}>Hello</div>`,
        ),
      ).toThrow(RenderError);
      expect(() =>
        validateJsx(
          `<div style={{ backgroundImage: "url('//evil.com/pic.png')" }}>Hello</div>`,
        ),
      ).toThrow(RenderError);
    });

    test("rejects whitespace-padded and mixed-case URL schemes", () => {
      expect(() =>
        validateJsx(
          `<div style={{ display: "flex" }}><img src="   JaVaScRiPt:alert(1)   " /></div>`,
        ),
      ).toThrow(RenderError);
      expect(() =>
        validateJsx(
          `<div style={{ display: "flex" }}><img src="VBSCRIPT:alert(1)" /></div>`,
        ),
      ).toThrow(RenderError);
    });
  });

  describe("DoS and AST Bombs", () => {
    test("rejects recursion depth bombs (100+ nested divs)", () => {
      let bomb = "<span>Deep</span>";
      for (let i = 0; i < 100; i++) {
        bomb = `<div>${bomb}</div>`;
      }
      expect(() => validateJsx(bomb)).toThrow(RenderError);
      try {
        validateJsx(bomb);
      } catch (err) {
        expect((err as RenderError).code).toBe("UNSUPPORTED_SYNTAX");
        expect((err as RenderError).message).toContain(
          "AST depth exceeds maximum allowed depth",
        );
      }
    });

    test("rejects oversized AST node count bombs (3,000+ nodes)", () => {
      const spans: string[] = [];
      for (let i = 0; i < 3000; i++) {
        spans.push(`<span>Node ${i}</span>`);
      }
      const bomb = `<div>${spans.join("")}</div>`;
      expect(() => validateJsx(bomb)).toThrow(RenderError);
      try {
        validateJsx(bomb);
      } catch (err) {
        expect((err as RenderError).code).toBe("UNSUPPORTED_SYNTAX");
        expect((err as RenderError).message).toContain(
          "AST node count exceeds maximum allowed limit",
        );
      }
    });
  });

  describe("Data-Only Interpretation Verification", () => {
    test("interprets code-like strings strictly as data without executing them", async () => {
      const sideEffectRan = false;
      // Define a marker on globalThis that could only change if code executed
      (
        globalThis as unknown as { __RENDERLOOM_EXPLOIT_CHECK__?: boolean }
      ).__RENDERLOOM_EXPLOIT_CHECK__ = false;

      const codeString = `
        <div style={{ display: "flex", width: "100%", height: "100%", backgroundColor: "#fff" }}>
          <span>{/* This string looks like code but is just static text */}</span>
          <span>{"globalThis.__RENDERLOOM_EXPLOIT_CHECK__ = true; process.exit(1);"}</span>
        </div>
      `;

      const validated = validateJsx(codeString);
      const vnode = await interpretJsx(validated);

      // Verify VNode tree contains the text literally as data
      expect(vnode.type).toBe("div");
      expect(Array.isArray(vnode.props.children)).toBe(true);
      const children = vnode.props.children as Array<{
        type: string;
        props: { children?: string };
      }>;
      expect(children[1]?.props.children).toBe(
        "globalThis.__RENDERLOOM_EXPLOIT_CHECK__ = true; process.exit(1);",
      );

      // Verify no code was executed in globalThis
      expect(
        (globalThis as unknown as { __RENDERLOOM_EXPLOIT_CHECK__?: boolean })
          .__RENDERLOOM_EXPLOIT_CHECK__,
      ).toBe(false);

      // Verify render succeeds producing valid SVG/PNG without executing the code
      const result = await render(codeString, { width: 400, height: 400 });
      expect(result.svg.startsWith("<svg")).toBe(true);
      expect(result.svg).toContain("<path");
      expect(result.png.byteLength).toBeGreaterThan(0);
      expect(
        (globalThis as unknown as { __RENDERLOOM_EXPLOIT_CHECK__?: boolean })
          .__RENDERLOOM_EXPLOIT_CHECK__,
      ).toBe(false);

      (
        globalThis as unknown as { __RENDERLOOM_EXPLOIT_CHECK__?: boolean }
      ).__RENDERLOOM_EXPLOIT_CHECK__ = undefined;
    });
  });
});
