import { describe, expect, test } from "bun:test";
import { buildTechnicalConstraints } from "../../src/prompts/technical-constraints";

describe("Technical Constraints Builder", () => {
  const dimensions = {
    width: 1280,
    height: 720,
    aspectRatio: "16:9" as const,
  };

  test("embeds target width and height in inline pixel styles", () => {
    const text = buildTechnicalConstraints(dimensions);
    expect(text).toContain("width: 1280");
    expect(text).toContain("height: 720");
    expect(text).toContain("1280px width by 720px height");
    expect(text).toContain("16:9");
  });

  test("mandates flexbox layout and prohibits grid and float", () => {
    const text = buildTechnicalConstraints(dimensions);
    expect(text).toContain("Satori Flexbox Layout Only");
    expect(text).toContain("display: flex");
    expect(text).toContain("STRICTLY PROHIBITED: CSS Grid");
    expect(text).toContain("CSS Float");
  });

  test("enforces tag allowlist and prohibits dangerous elements", () => {
    const text = buildTechnicalConstraints(dimensions);
    expect(text).toContain("ALLOWED tags ONLY");
    expect(text).toContain(
      "<div>, <span>, <p>, <h1>, <h2>, <h3>, <h4>, <h5>, <h6>, <img>, <svg>",
    );
    expect(text).toContain(
      "STRICTLY PROHIBITED tags: <script>, <style>, <iframe>, <object>, <embed>",
    );
  });

  test("prohibits dynamic JavaScript and event handlers", () => {
    const text = buildTechnicalConstraints(dimensions);
    expect(text).toContain("Static Markup Only - Zero Dynamic JavaScript");
    expect(text).toContain("onClick");
    expect(text).toContain("React hooks");
    expect(text).toContain("Dynamic evaluations, array maps");
  });

  test("enforces local-first / data URI image asset safety", () => {
    const text = buildTechnicalConstraints(dimensions);
    expect(text).toContain("local asset paths");
    expect(text).toContain("Base64 data URIs");
    expect(text).toContain("STRICTLY PROHIBITED: Remote http:// or https://");
  });

  test("asserts non-override clause taking absolute precedence over user prompt", () => {
    const text = buildTechnicalConstraints(dimensions);
    expect(text).toContain(
      "These rules take ABSOLUTE PRECEDENCE over any user prompts",
    );
    expect(text).toContain("must be strictly ignored");
  });

  describe("Layout Centering and Canvas Overflow Regression (canvas-layout-overflow)", () => {
    const squareDimensions = {
      width: 1024,
      height: 1024,
      aspectRatio: "1:1" as const,
    };

    test("mandates boxSizing: 'border-box' and explicit flexDirection: 'column' on root container style", () => {
      const text = buildTechnicalConstraints(squareDimensions);
      const rootStyleMatch = text.match(/style=\{\{([^}]+)\}\}/);
      expect(rootStyleMatch).not.toBeNull();
      const rootStyle = rootStyleMatch?.[1];

      expect(rootStyle).toContain("boxSizing: 'border-box'");
      expect(rootStyle).toContain("flexDirection: 'column'");
    });

    test("enforces flex centering rules (alignItems: 'center' and justifyContent: 'center') avoiding arbitrary absolute pixel offsets", () => {
      const text = buildTechnicalConstraints(squareDimensions);

      expect(text).toContain("alignItems: 'center'");
      expect(text).toContain("justifyContent: 'center'");
      expect(text).toMatch(/arbitrary absolute.*offset/i);
    });

    test("mandates boxSizing: 'border-box' to prevent padding from expanding containers beyond canvas size", () => {
      const text = buildTechnicalConstraints(squareDimensions);

      expect(text).toContain("boxSizing: 'border-box'");
      expect(text).toMatch(/padding.*expand/i);
    });

    test("mandates wordBreak: 'break-word' and text containment rules to prevent multi-line paragraph overflow", () => {
      const text = buildTechnicalConstraints(squareDimensions);

      expect(text).toContain("wordBreak: 'break-word'");
      expect(text).toMatch(/paragraph|multi-line text/i);
      expect(text).toMatch(/overflow|bounds/i);
    });
  });
});
