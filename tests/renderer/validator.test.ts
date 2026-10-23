import { describe, expect, test } from "bun:test";
import { RenderError } from "../../src/domain/errors";
import { validateJsx } from "../../src/renderer/validator";

describe("Restricted JSX Validator", () => {
  describe("Root Element Restrictions", () => {
    test("rejects empty source", () => {
      expect(() => validateJsx("")).toThrow(RenderError);
      try {
        validateJsx("   ");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("UNSUPPORTED_SYNTAX");
      }
    });

    test("rejects non-div root element", () => {
      expect(() => validateJsx("<span>Not allowed</span>")).toThrow(
        RenderError,
      );
      try {
        validateJsx("<span>Not allowed</span>");
      } catch (err) {
        expect((err as RenderError).code).toBe("UNSUPPORTED_SYNTAX");
        expect((err as RenderError).message).toContain(
          "Root element must be <div>",
        );
      }
    });

    test("rejects JSX fragment as root", () => {
      expect(() => validateJsx("<><div>Fragment</div></>")).toThrow(
        RenderError,
      );
      try {
        validateJsx("<><div>Fragment</div></>");
      } catch (err) {
        expect((err as RenderError).code).toBe("UNSUPPORTED_SYNTAX");
      }
    });

    test("rejects multiple root statements", () => {
      const code = `
        <div>First</div>
        <div>Second</div>
      `;
      expect(() => validateJsx(code)).toThrow(RenderError);
    });
  });

  describe("Dangerous Code and Tag Prohibitions", () => {
    test("rejects import statements", () => {
      const code = `import fs from "fs"; <div>Hello</div>`;
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects function declarations", () => {
      const code = "function App() { return <div>Hello</div>; }";
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects class declarations", () => {
      const code = "class Component { render() { return <div>Hello</div>; } }";
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects variable statements", () => {
      const code = "const x = 1; <div>Hello</div>";
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects script tags", () => {
      const code = `<div><script>alert("pwned")</script></div>`;
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects iframe tags", () => {
      const code = `<div><iframe src="http://evil.com" /></div>`;
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects style tags", () => {
      const code = "<div><style>body { background: red; }</style></div>";
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects event handlers", () => {
      const code = "<div onClick={() => alert(1)}>Click me</div>";
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain("Event handlers");
      }
    });

    test("rejects onmouseover and onFocus handlers", () => {
      expect(() =>
        validateJsx(`<div onmouseover="evil()">Hover</div>`),
      ).toThrow(RenderError);
      expect(() => validateJsx("<div onFocus={() => {}}>Focus</div>")).toThrow(
        RenderError,
      );
    });

    test("rejects JSX spread attributes", () => {
      const code = "<div {...props}>Spread</div>";
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        expect((err as RenderError).message).toContain("spread");
      }
    });

    test("rejects function calls in attributes", () => {
      const code = `<div id={eval("secret")}>Hello</div>`;
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects function calls in style object", () => {
      const code = `<div style={{ color: eval("red") }}>Hello</div>`;
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects spread in style object", () => {
      const code = "<div style={{ ...otherStyles }}>Hello</div>";
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects functions in JSX children", () => {
      const code = `<div>{() => "danger"}</div>`;
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });
  });

  describe("Unsupported Syntax and Elements", () => {
    test("rejects unknown HTML elements", () => {
      const code = "<div><button>Click</button></div>";
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("UNSUPPORTED_SYNTAX");
        expect((err as RenderError).message).toContain(
          "Unsupported element <button>",
        );
      }
    });

    test("rejects marquee element", () => {
      expect(() => validateJsx("<div><marquee>Scroll</marquee></div>")).toThrow(
        RenderError,
      );
    });

    test("rejects dynamic arithmetic expressions in children", () => {
      const code = "<div>{1 + 1}</div>";
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("UNSUPPORTED_SYNTAX");
        expect((err as RenderError).message).toContain("Dynamic expressions");
      }
    });

    test("rejects loops and method calls in children", () => {
      const code = "<div>{items.map(item => <span>{item}</span>)}</div>";
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect(
          (err as RenderError).code === "UNSUPPORTED_SYNTAX" ||
            (err as RenderError).code === "DANGEROUS_CODE_DETECTED",
        ).toBe(true);
      }
    });

    test("rejects dynamic variables in children", () => {
      const code = "<div>{userName}</div>";
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("UNSUPPORTED_SYNTAX");
      }
    });
  });

  describe("Remote Assets and Image URLs", () => {
    test("rejects http remote URL in img src", () => {
      const code = `<div><img src="http://evil.com/image.png" /></div>`;
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
      }
    });

    test("rejects https remote URL in img src", () => {
      const code = `<div><img src="https://evil.com/image.png" /></div>`;
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
      }
    });

    test("rejects protocol-relative URL in img src", () => {
      const code = `<div><img src="//evil.com/image.png" /></div>`;
      try {
        validateJsx(code);
        expect().fail("Expected error");
      } catch (err) {
        expect(err instanceof RenderError).toBe(true);
        expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
      }
    });
  });

  describe("Allowed Valid Constructs", () => {
    test("accepts valid static JSX container with styled children", () => {
      const code = `
        <div style={{ display: "flex", width: 400, height: 200, backgroundColor: "#ffffff" }}>
          <span style={{ fontSize: 16, color: "#333333" }}>Hello Renderloom</span>
          <p style={{ margin: 0, padding: 8 }}>Paragraph text</p>
        </div>
      `;
      const validated = validateJsx(code);
      expect(validated.sourceFile).toBeDefined();
      expect(validated.rootElement).toBeDefined();
    });

    test("accepts export default wrapped JSX", () => {
      const code = `
        export default (
          <div style={{ display: "flex" }}>
            <span>Exported default element</span>
          </div>
        );
      `;
      const validated = validateJsx(code);
      expect(validated.rootElement).toBeDefined();
    });

    test("accepts SVG elements", () => {
      const code = `
        <div style={{ display: "flex" }}>
          <svg width={100} height={100} viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={40} fill="red" />
            <rect x={10} y={10} width={80} height={80} fill="blue" />
            <path d="M 10 10 H 90 V 90 H 10 Z" fill="none" stroke="black" />
          </svg>
        </div>
      `;
      const validated = validateJsx(code);
      expect(validated.rootElement).toBeDefined();
    });

    test("accepts data:image URI in img tag", () => {
      const code = `
        <div style={{ display: "flex" }}>
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" width={10} height={10} />
        </div>
      `;
      const validated = validateJsx(code);
      expect(validated.rootElement).toBeDefined();
    });
  });
});
