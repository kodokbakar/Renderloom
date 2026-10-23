export const STYLE_SCHEMA_VERSION = 1;

export interface StylePalette {
  background: string;
  foreground: string;
  primary: string;
  secondary?: string;
  accent: string;
  muted?: string;
  border?: string;
}

export interface TypographyGuidance {
  fontFamily: string;
  headingWeight?: string | number;
  bodyWeight?: string | number;
  scale?: string[];
  guidelines: string[];
}

export interface LayoutGuidance {
  structure: string;
  spacing: string;
  alignment: string;
  rules: string[];
}

export interface VisualSample {
  background: string;
  foreground: string;
  accent: string;
  previewText?: string;
}

export interface StylePreset {
  schemaVersion: number;
  id: string;
  name: string;
  description: string;
  designPrinciples: string[];
  palette: StylePalette;
  typography: TypographyGuidance;
  layout: LayoutGuidance;
  allowedEffects: string[];
  patternsToAvoid: string[];
  visualSample: VisualSample;
}

export interface StylePresetSummary {
  id: string;
  name: string;
  description: string;
  palette: StylePalette;
  visualSample: VisualSample;
}
