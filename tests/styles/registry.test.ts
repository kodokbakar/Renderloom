import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ValidationError } from "../../src/domain/errors";
import { StyleRegistry } from "../../src/styles/registry";

describe("Style Registry & Built-in Presets", () => {
  const registry = new StyleRegistry();

  test("discovers and loads all 5 built-in presets", async () => {
    const presets = await registry.listPresets();
    expect(presets.length).toBe(5);

    const ids = presets.map((p) => p.id).sort();
    expect(ids).toEqual([
      "bauhaus",
      "brutalist",
      "editorial",
      "minimal",
      "swiss",
    ]);
  });

  test("each preset contains required visualSample and palette", async () => {
    const presets = await registry.listPresets();
    for (const preset of presets) {
      expect(preset.name).toBeDefined();
      expect(preset.description).toBeDefined();
      expect(preset.palette.background).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(preset.palette.foreground).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(preset.palette.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(preset.visualSample.previewText).toBeDefined();
    }
  });

  test("retrieves individual presets with full details", async () => {
    const bauhaus = await registry.getPreset("bauhaus");
    expect(bauhaus.id).toBe("bauhaus");
    expect(bauhaus.designPrinciples.length).toBeGreaterThan(0);
    expect(bauhaus.typography.guidelines.length).toBeGreaterThan(0);
    expect(bauhaus.layout.rules.length).toBeGreaterThan(0);
    expect(bauhaus.allowedEffects.length).toBeGreaterThan(0);
    expect(bauhaus.patternsToAvoid.length).toBeGreaterThan(0);

    const brutalist = await registry.getPreset("brutalist");
    expect(brutalist.palette.border).toBe("#000000");

    const swiss = await registry.getPreset("swiss");
    expect(swiss.palette.primary).toBe("#E11D48");

    const editorial = await registry.getPreset("editorial");
    expect(editorial.palette.background).toBe("#FAF7F2");

    const minimal = await registry.getPreset("minimal");
    expect(minimal.palette.background).toBe("#FFFFFF");
  });

  test("resolves aliases 'tech-minimal' and 'modern-clean' with overridden id and name", async () => {
    const techMinimal = await registry.getPreset("tech-minimal");
    expect(techMinimal.id).toBe("tech-minimal");
    expect(techMinimal.name).toBe("Tech Minimal");
    expect(techMinimal.palette.background).toBe("#FFFFFF");

    const modernClean = await registry.getPreset("modern-clean");
    expect(modernClean.id).toBe("modern-clean");
    expect(modernClean.name).toBe("Modern Clean");
    expect(modernClean.palette.background).toBe("#FFFFFF");
  });

  test("hasPreset correctly checks canonical presets and aliases", async () => {
    expect(await registry.hasPreset("minimal")).toBe(true);
    expect(await registry.hasPreset("tech-minimal")).toBe(true);
    expect(await registry.hasPreset("modern-clean")).toBe(true);
    expect(await registry.hasPreset("nonexistent-style")).toBe(false);
  });

  test("formats style instructions for aliases using alias name", async () => {
    const instructions = await registry.formatStyleInstructions("tech-minimal");
    expect(instructions).toContain("### Style Preset: Tech Minimal");
    expect(instructions).toContain("Design Principles");
    expect(instructions).toContain("Palette");
  });

  test("throws ValidationError on unknown preset ID", async () => {
    expect(registry.getPreset("cyberpunk-nonexistent")).rejects.toThrow(
      ValidationError,
    );
  });

  test("formats concrete, actionable LLM style instructions", async () => {
    const instructions = await registry.formatStyleInstructions("swiss");
    expect(instructions).toContain("### Style Preset: Swiss International");
    expect(instructions).toContain("Design Principles");
    expect(instructions).toContain("Palette");
    expect(instructions).toContain("#E11D48");
    expect(instructions).toContain("Typography");
    expect(instructions).toContain("Layout & Spacing");
    expect(instructions).toContain("Patterns to Avoid");
  });

  test("rejects malformed preset files in custom directory", async () => {
    const tempDir = path.join(
      process.cwd(),
      "Outputs",
      `test-bad-presets-${Date.now()}`,
    );
    mkdirSync(tempDir, { recursive: true });

    try {
      writeFileSync(
        path.join(tempDir, "bad.json"),
        JSON.stringify({ schemaVersion: 1, id: "bad" }),
      );
      const badRegistry = new StyleRegistry(tempDir);
      expect(badRegistry.loadPresets()).rejects.toThrow(ValidationError);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("rejects duplicate preset IDs in custom directory", async () => {
    const tempDir = path.join(
      process.cwd(),
      "Outputs",
      `test-dup-presets-${Date.now()}`,
    );
    mkdirSync(tempDir, { recursive: true });

    const validBauhaus = await registry.getPreset("bauhaus");

    try {
      writeFileSync(
        path.join(tempDir, "p1.json"),
        JSON.stringify(validBauhaus),
      );
      writeFileSync(
        path.join(tempDir, "p2.json"),
        JSON.stringify(validBauhaus),
      );
      const dupRegistry = new StyleRegistry(tempDir);
      expect(dupRegistry.loadPresets()).rejects.toThrow(ValidationError);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
