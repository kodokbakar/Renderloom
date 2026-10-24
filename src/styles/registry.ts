import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { ValidationError } from "../domain/errors";
import type { StylePreset, StylePresetSummary } from "../domain/style";
import { validateStylePreset } from "./schema";

export function resolvePresetsDir(customDir?: string): string {
  if (customDir) {
    return path.resolve(customDir);
  }
  const cwdPresets = path.resolve(process.cwd(), "style-presets");
  if (existsSync(cwdPresets)) {
    return cwdPresets;
  }
  const moduleRelativePresets = path.resolve(__dirname, "../../style-presets");
  if (existsSync(moduleRelativePresets)) {
    return moduleRelativePresets;
  }
  return cwdPresets;
}
const STYLE_ALIASES: Record<string, { targetId: string; name?: string }> = {
  "tech-minimal": { targetId: "minimal", name: "Tech Minimal" },
  "modern-clean": { targetId: "minimal", name: "Modern Clean" },
};

export class StyleRegistry {
  private readonly presetsDir: string;
  private presetsCache: Map<string, StylePreset> | null = null;

  constructor(customPresetsDir?: string) {
    this.presetsDir = resolvePresetsDir(customPresetsDir);
  }

  async loadPresets(forceReload = false): Promise<Map<string, StylePreset>> {
    if (this.presetsCache && !forceReload) {
      return this.presetsCache;
    }

    if (!existsSync(this.presetsDir)) {
      throw new ValidationError(
        `Style presets directory not found: ${this.presetsDir}`,
      );
    }

    const entries = await readdir(this.presetsDir, { withFileTypes: true });
    const cache = new Map<string, StylePreset>();

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const filePath = path.join(this.presetsDir, entry.name);
      let content: string;
      try {
        content = await readFile(filePath, "utf-8");
      } catch (err) {
        throw new ValidationError(
          `Failed to read style preset file '${entry.name}'`,
          err,
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        throw new ValidationError(
          `Malformed JSON in style preset file '${entry.name}'`,
          err,
        );
      }

      const validated = validateStylePreset(parsed);
      if (cache.has(validated.id)) {
        throw new ValidationError(
          `Duplicate style preset ID '${validated.id}' in '${entry.name}'`,
        );
      }
      cache.set(validated.id, validated);
    }

    this.presetsCache = cache;
    return cache;
  }

  async listPresets(): Promise<StylePresetSummary[]> {
    const cache = await this.loadPresets();
    return Array.from(cache.values()).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      palette: p.palette,
      visualSample: p.visualSample,
    }));
  }

  async getPreset(id: string): Promise<StylePreset> {
    const cache = await this.loadPresets();
    const preset = cache.get(id);
    if (preset) {
      return preset;
    }
    const alias = STYLE_ALIASES[id];
    if (alias) {
      const targetPreset = cache.get(alias.targetId);
      if (targetPreset) {
        return {
          ...targetPreset,
          id,
          name: alias.name ?? targetPreset.name,
        };
      }
    }
    throw new ValidationError(
      `Style preset '${id}' not found. Available styles: ${Array.from(cache.keys()).join(", ")}`,
    );
  }

  async hasPreset(id: string): Promise<boolean> {
    const cache = await this.loadPresets();
    if (cache.has(id)) {
      return true;
    }
    const alias = STYLE_ALIASES[id];
    return Boolean(alias && cache.has(alias.targetId));
  }

  async formatStyleInstructions(id: string): Promise<string> {
    const preset = await this.getPreset(id);

    const principles = preset.designPrinciples.map((p) => `- ${p}`).join("\n");

    const paletteLines = [
      `- Background: ${preset.palette.background}`,
      `- Foreground (Text): ${preset.palette.foreground}`,
      `- Primary Brand/Key: ${preset.palette.primary}`,
    ];
    if (preset.palette.secondary) {
      paletteLines.push(`- Secondary: ${preset.palette.secondary}`);
    }
    paletteLines.push(`- Accent: ${preset.palette.accent}`);
    if (preset.palette.muted) {
      paletteLines.push(`- Muted: ${preset.palette.muted}`);
    }
    if (preset.palette.border) {
      paletteLines.push(`- Border: ${preset.palette.border}`);
    }

    const typoLines = [`- Font Family: ${preset.typography.fontFamily}`];
    if (preset.typography.headingWeight) {
      typoLines.push(`- Heading Weight: ${preset.typography.headingWeight}`);
    }
    if (preset.typography.bodyWeight) {
      typoLines.push(`- Body Weight: ${preset.typography.bodyWeight}`);
    }
    if (preset.typography.scale && preset.typography.scale.length > 0) {
      typoLines.push(`- Scale: ${preset.typography.scale.join(", ")}`);
    }
    const typoGuidelines = preset.typography.guidelines
      .map((g) => `  * ${g}`)
      .join("\n");

    const layoutRules = preset.layout.rules.map((r) => `  * ${r}`).join("\n");
    const allowedEffects = preset.allowedEffects
      .map((e) => `- ${e}`)
      .join("\n");
    const avoid = preset.patternsToAvoid.map((a) => `- AVOID: ${a}`).join("\n");

    return `### Style Preset: ${preset.name} (${preset.id})
${preset.description}

#### Design Principles
${principles}

#### Palette
${paletteLines.join("\n")}

#### Typography
${typoLines.join("\n")}
- Guidelines:
${typoGuidelines}

#### Layout & Spacing
- Structure: ${preset.layout.structure}
- Spacing: ${preset.layout.spacing}
- Alignment: ${preset.layout.alignment}
- Rules:
${layoutRules}

#### Allowed Effects
${allowedEffects}

#### Patterns to Avoid
${avoid}`;
  }
}
