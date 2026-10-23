import { describe, expect, test } from "bun:test";
import { ValidationError } from "../../src/domain/errors";
import { STYLE_SCHEMA_VERSION, type StylePreset } from "../../src/domain/style";
import {
  StylePresetSchema,
  validateStylePreset,
} from "../../src/styles/schema";

const validPreset: StylePreset = {
  schemaVersion: STYLE_SCHEMA_VERSION,
  id: "test-style",
  name: "Test Style",
  description: "A test style preset",
  designPrinciples: ["Form follows function", "Grid alignment"],
  palette: {
    background: "#ffffff",
    foreground: "#111111",
    primary: "#d02020",
    secondary: "#1d4ed8",
    accent: "#fbbf24",
    border: "#e5e7eb",
  },
  typography: {
    fontFamily: "Inter, sans-serif",
    headingWeight: 700,
    bodyWeight: 400,
    guidelines: ["Use bold headers", "Maintain line height of 1.4"],
  },
  layout: {
    structure: "Columnar flexbox",
    spacing: "Generous 24px-32px padding",
    alignment: "Left-aligned",
    rules: ["Root container flex-col", "Consistent gap 16px"],
  },
  allowedEffects: ["border", "box-shadow"],
  patternsToAvoid: ["Gradients", "Skew transforms"],
  visualSample: {
    background: "#ffffff",
    foreground: "#111111",
    accent: "#fbbf24",
    previewText: "Test",
  },
};

describe("Style Preset Schema Validation", () => {
  test("accepts a fully compliant style preset", () => {
    const validated = validateStylePreset(validPreset);
    expect(validated.id).toBe("test-style");
    expect(validated.schemaVersion).toBe(STYLE_SCHEMA_VERSION);
  });

  test("rejects invalid schema version", () => {
    const invalid = { ...validPreset, schemaVersion: 99 };
    expect(() => validateStylePreset(invalid)).toThrow(ValidationError);
  });

  test("rejects invalid id formatting", () => {
    expect(() =>
      validateStylePreset({ ...validPreset, id: "Invalid ID with spaces" }),
    ).toThrow(ValidationError);
    expect(() =>
      validateStylePreset({ ...validPreset, id: "UPPERCASE" }),
    ).toThrow(ValidationError);
    expect(() =>
      validateStylePreset({ ...validPreset, id: "id_with_underscores" }),
    ).toThrow(ValidationError);
  });

  test("rejects invalid hex colors in palette", () => {
    const invalid = {
      ...validPreset,
      palette: {
        ...validPreset.palette,
        background: "red", // not hex
      },
    };
    expect(() => validateStylePreset(invalid)).toThrow(ValidationError);
  });

  test("rejects invalid hex in visualSample", () => {
    const invalid = {
      ...validPreset,
      visualSample: {
        ...validPreset.visualSample,
        accent: "not-a-color",
      },
    };
    expect(() => validateStylePreset(invalid)).toThrow(ValidationError);
  });

  test("rejects empty required rule arrays", () => {
    expect(() =>
      validateStylePreset({ ...validPreset, designPrinciples: [] }),
    ).toThrow(ValidationError);
    expect(() =>
      validateStylePreset({
        ...validPreset,
        typography: { ...validPreset.typography, guidelines: [] },
      }),
    ).toThrow(ValidationError);
    expect(() =>
      validateStylePreset({
        ...validPreset,
        layout: { ...validPreset.layout, rules: [] },
      }),
    ).toThrow(ValidationError);
    expect(() =>
      validateStylePreset({ ...validPreset, patternsToAvoid: [] }),
    ).toThrow(ValidationError);
  });

  test("rejects missing mandatory fields", () => {
    const { name, ...missingName } = validPreset;
    expect(() => validateStylePreset(missingName)).toThrow(ValidationError);
  });
});
