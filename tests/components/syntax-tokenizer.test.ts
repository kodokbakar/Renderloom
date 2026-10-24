import { describe, expect, test } from "bun:test";
import {
  tokenizeJsxOrSvg,
  tokenizeLines,
} from "../../src/components/utils/syntax-tokenizer";

describe("syntax-tokenizer", () => {
  test("tokenizes JSX tags, keywords, strings, and attributes", () => {
    const code = `import React from 'react';\nexport default function Card() {\n  return <svg width="100" />;\n}`;
    const tokens = tokenizeJsxOrSvg(code, "jsx");

    expect(tokens.length).toBeGreaterThan(0);

    const keywords = tokens
      .filter((t) => t.type === "keyword")
      .map((t) => t.value);
    expect(keywords).toContain("import");
    expect(keywords).toContain("export");
    expect(keywords).toContain("default");
    expect(keywords).toContain("function");
    expect(keywords).toContain("return");

    const strings = tokens
      .filter((t) => t.type === "string")
      .map((t) => t.value);
    expect(strings).toContain("'react'");
    expect(strings).toContain('"100"');

    const tags = tokens.filter((t) => t.type === "tag").map((t) => t.value);
    expect(tags).toContain("<svg");
    expect(tags).toContain("/>");

    const attrs = tokens.filter((t) => t.type === "attr").map((t) => t.value);
    expect(attrs).toContain("width");
  });

  test("tokenizes SVG XML elements, comments, and numbers", () => {
    const svg = `<!-- Main Canvas -->\n<svg width="200" height="200">\n  <rect x="0" y="0" width="100" height="100" fill="#fff" />\n</svg>`;
    const tokens = tokenizeJsxOrSvg(svg, "svg");

    const comments = tokens
      .filter((t) => t.type === "comment")
      .map((t) => t.value);
    expect(comments).toContain("<!-- Main Canvas -->");

    const tags = tokens.filter((t) => t.type === "tag").map((t) => t.value);
    expect(tags).toContain("<svg");
    expect(tags).toContain("<rect");
    expect(tags).toContain("/>");
    expect(tags).toContain("</svg>");
  });

  test("handles empty and plain text inputs", () => {
    expect(tokenizeJsxOrSvg("", "jsx")).toEqual([]);
    const plain = tokenizeJsxOrSvg("hello world", "jsx");
    expect(plain.map((t) => t.value).join("")).toBe("hello world");
  });

  test("tokenizeLines splits tokens into lines correctly", () => {
    const code = "<svg>\n  <path />\n</svg>";
    const lines = tokenizeLines(code, "svg");
    expect(lines.length).toBe(3);
    expect(lines[0]?.some((t) => t.value === "<svg")).toBe(true);
    expect(lines[1]?.some((t) => t.value === "<path")).toBe(true);
    expect(lines[2]?.some((t) => t.value === "</svg>")).toBe(true);
  });

  test("tokenizes deeply nested JSX hierarchy and JSX block/line comments", () => {
    const jsx = `/* Outer Component */\n<div style={{ display: 'flex' }}>\n  // Inner section\n  <header>\n    <h1 title="Welcome">Title</h1>\n  </header>\n  <span>Text</span>\n</div>`;
    const tokens = tokenizeJsxOrSvg(jsx, "jsx");

    const tags = tokens.filter((t) => t.type === "tag").map((t) => t.value);
    expect(tags).toContain("<div");
    expect(tags).toContain("<header");
    expect(tags).toContain("<h1");
    expect(tags).toContain("</h1>");
    expect(tags).toContain("</header>");
    expect(tags).toContain("<span");
    expect(tags).toContain("</span>");
    expect(tags).toContain("</div>");

    const comments = tokens
      .filter((t) => t.type === "comment")
      .map((t) => t.value);
    expect(comments).toContain("/* Outer Component */");
    expect(comments).toContain("// Inner section");
  });

  test("tokenizes numbers with units and template literals in JSX", () => {
    const snippet =
      "const template = `card-hero`; const width = 100px; const opacity = 0.5; const rem = 2.5rem;";
    const tokens = tokenizeJsxOrSvg(snippet, "jsx");

    const strings = tokens
      .filter((t) => t.type === "string")
      .map((t) => t.value);
    expect(strings).toContain("`card-hero`");

    const numbers = tokens
      .filter((t) => t.type === "number")
      .map((t) => t.value);
    expect(numbers).toContain("100px");
    expect(numbers).toContain("0.5");
    expect(numbers).toContain("2.5rem");
  });

  test("handles malformed or unclosed syntax gracefully without throwing", () => {
    const broken = '<div unclosed="string and <!-- unclosed comment';
    const tokens = tokenizeJsxOrSvg(broken, "jsx");
    expect(tokens.length).toBeGreaterThan(0);
    const reconstructed = tokens.map((t) => t.value).join("");
    expect(reconstructed).toBe(broken);
  });
});
