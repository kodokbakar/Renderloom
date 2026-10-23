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

    test("rejects relative filesystem paths without baseDir in img src", () => {
      const relativeSrcs = [
        "package.json",
        ".env",
        "logo.png",
        "./logo.png",
        "assets/pic.png",
      ];
      for (const src of relativeSrcs) {
        const code = `<div><img src="${src}" /></div>`;
        expect(() => validateJsx(code)).toThrow(RenderError);
        try {
          validateJsx(code);
        } catch (err) {
          expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
        }
      }
    });

    test("rejects CSS url(...) containing remote schemes in style attribute", () => {
      const maliciousStyles = [
        `<div style={{ display: "flex", backgroundImage: "url(http://evil.com/leak.png)" }}>Hello</div>`,
        `<div style={{ display: "flex", backgroundImage: "url('https://evil.com/leak.png')" }}>Hello</div>`,
        `<div style={{ display: "flex", backgroundImage: 'url("https://evil.com/leak.png")' }}>Hello</div>`,
        `<div style={{ display: "flex", backgroundImage: "url(//evil.com/leak.png)" }}>Hello</div>`,
        `<div style={{ display: "flex", backgroundImage: "url(ftp://evil.com/leak.png)" }}>Hello</div>`,
        `<div style={{ display: "flex", background: "linear-gradient(red, blue), url(https://evil.com/leak.png)" }}>Hello</div>`,
        `<div style={{ display: "flex", backgroundImage: "url('gopher://localhost:11211')" }}>Hello</div>`,
        `<div style={{ display: "flex", backgroundImage: "url(data:text/html,<script>alert(1)</script>)" }}>Hello</div>`,
      ];

      for (const code of maliciousStyles) {
        expect(() => validateJsx(code)).toThrow(RenderError);
        try {
          validateJsx(code);
        } catch (err) {
          expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
        }
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

    test("permits safe data:image URL in CSS style attribute", () => {
      const code = `
        <div style={{ display: "flex", backgroundImage: "url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==)" }}>
          <span>Safe background</span>
        </div>
      `;
      const validated = validateJsx(code);
      expect(validated.rootElement).toBeDefined();
    });
  });

  describe("Negative Security: eval, new Function, and dynamic imports", () => {
    test("rejects new Function call in children", () => {
      const code = "<div>{new Function('return 1')()}</div>";
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects uninvoked new Function in children", () => {
      const code = "<div>{new Function('return 1')}</div>";
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("UNSUPPORTED_SYNTAX");
      }
    });

    test("rejects new Function in attributes", () => {
      const code = "<div id={new Function('return 1')()}>Hello</div>";
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects new Function in styles", () => {
      const code =
        "<div style={{ color: new Function('return 1')() }}>Hello</div>";
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects dynamic import in children", () => {
      const code = "<div>{import('./evil.js')}</div>";
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects dynamic import in attributes", () => {
      const code = "<div id={import('fs')}>Hello</div>";
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects top-level dynamic import call", () => {
      const code = "import('./evil.js');";
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("UNSUPPORTED_SYNTAX");
      }
    });

    test("rejects eval in children", () => {
      const code = "<div>{eval('secret')}</div>";
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects top-level eval call", () => {
      const code = "eval('secret');";
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("UNSUPPORTED_SYNTAX");
      }
    });
  });

  describe("Nested and Complex Attack Vectors", () => {
    test("rejects deeply nested script tags", () => {
      const code = "<div><div><div><script>alert(1)</script></div></div></div>";
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects object, embed, link, meta tags", () => {
      const tags = ["object", "embed", "link", "meta"];
      for (const tag of tags) {
        const code = `<div><${tag} /></div>`;
        expect(() => validateJsx(code)).toThrow(RenderError);
        try {
          validateJsx(code);
        } catch (err) {
          expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
        }
      }
    });

    test("rejects deeply nested event handlers", () => {
      const code =
        "<div><div><span onmouseover='evil()'>Hover</span></div></div>";
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects deeply nested spread attributes", () => {
      const code = "<div><div><span {...props} /></div></div>";
      expect(() => validateJsx(code)).toThrow(RenderError);
      try {
        validateJsx(code);
      } catch (err) {
        expect((err as RenderError).code).toBe("DANGEROUS_CODE_DETECTED");
      }
    });

    test("rejects template literal substitutions in attributes and children", () => {
      expect(() =>
        validateJsx("<div id={`${1 + 1}`}>Interpolated</div>"),
      ).toThrow(RenderError);
      expect(() => validateJsx("<div>{`${process.env.SECRET}`}</div>")).toThrow(
        RenderError,
      );
    });

    test("rejects dangerous URI schemes in img src", () => {
      const dangerousSrcs = [
        "javascript:alert(1)",
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        "file:///etc/passwd",
      ];
      for (const src of dangerousSrcs) {
        const code = `<div><img src="${src}" /></div>`;
        expect(() => validateJsx(code)).toThrow(RenderError);
        try {
          validateJsx(code);
        } catch (err) {
          expect((err as RenderError).code).toBe("UNTRUSTED_REMOTE_ASSET");
        }
      }
    });

    test("rejects truncated/malformed JSX syntax like <div><span", () => {
      const malformedSnippets = [
        "<div><span",
        "<div><span attr=",
        "<div><img",
        "<div style={{",
        "<div><span></div>",
        "<div><span>Mismatched</div></span>",
      ];

      for (const code of malformedSnippets) {
        expect(() => validateJsx(code)).toThrow(RenderError);
        try {
          validateJsx(code);
        } catch (err) {
          expect((err as RenderError).code).toBe("UNSUPPORTED_SYNTAX");
          expect((err as RenderError).message).toContain("JSX syntax error");
        }
      }
    });
  });
});
