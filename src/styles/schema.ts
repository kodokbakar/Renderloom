import { z } from "zod";
import { ValidationError } from "../domain/errors";
import { STYLE_SCHEMA_VERSION, type StylePreset } from "../domain/style";

export const HEX_COLOR_REGEX =
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export const StylePaletteSchema = z.object({
  background: z
    .string()
    .regex(HEX_COLOR_REGEX, "background must be a valid hex color"),
  foreground: z
    .string()
    .regex(HEX_COLOR_REGEX, "foreground must be a valid hex color"),
  primary: z
    .string()
    .regex(HEX_COLOR_REGEX, "primary must be a valid hex color"),
  secondary: z
    .string()
    .regex(HEX_COLOR_REGEX, "secondary must be a valid hex color")
    .optional(),
  accent: z.string().regex(HEX_COLOR_REGEX, "accent must be a valid hex color"),
  muted: z
    .string()
    .regex(HEX_COLOR_REGEX, "muted must be a valid hex color")
    .optional(),
  border: z
    .string()
    .regex(HEX_COLOR_REGEX, "border must be a valid hex color")
    .optional(),
});

export const TypographySchema = z.object({
  fontFamily: z.string().min(1, "fontFamily is required"),
  headingWeight: z.union([z.string(), z.number()]).optional(),
  bodyWeight: z.union([z.string(), z.number()]).optional(),
  scale: z.array(z.string()).optional(),
  guidelines: z
    .array(z.string().min(1))
    .min(1, "At least one typography guideline is required"),
});

export const LayoutSchema = z.object({
  structure: z.string().min(1, "layout structure is required"),
  spacing: z.string().min(1, "spacing guidance is required"),
  alignment: z.string().min(1, "alignment guidance is required"),
  rules: z
    .array(z.string().min(1))
    .min(1, "At least one layout rule is required"),
});

export const VisualSampleSchema = z.object({
  background: z
    .string()
    .regex(HEX_COLOR_REGEX, "sample background must be hex color"),
  foreground: z
    .string()
    .regex(HEX_COLOR_REGEX, "sample foreground must be hex color"),
  accent: z.string().regex(HEX_COLOR_REGEX, "sample accent must be hex color"),
  previewText: z.string().optional(),
});

export const StylePresetSchema = z.object({
  schemaVersion: z.literal(STYLE_SCHEMA_VERSION, {
    errorMap: () => ({
      message: `Invalid schemaVersion, expected ${STYLE_SCHEMA_VERSION}`,
    }),
  }),
  id: z
    .string()
    .min(1, "id is required")
    .regex(
      /^[a-z0-9-]+$/,
      "id must contain only lowercase alphanumeric characters and hyphens",
    ),
  name: z.string().min(1, "name is required"),
  description: z.string().min(1, "description is required"),
  designPrinciples: z
    .array(z.string().min(1))
    .min(1, "At least one design principle is required"),
  palette: StylePaletteSchema,
  typography: TypographySchema,
  layout: LayoutSchema,
  allowedEffects: z.array(z.string()),
  patternsToAvoid: z
    .array(z.string().min(1))
    .min(1, "At least one pattern to avoid is required"),
  visualSample: VisualSampleSchema,
});

export function validateStylePreset(input: unknown): StylePreset {
  const result = StylePresetSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    throw new ValidationError(`Invalid style preset: ${issues}`, result.error);
  }
  return result.data as StylePreset;
}
