export type AspectRatioPreset = "1:1" | "4:5" | "3:2" | "16:9" | "custom";

export interface ResolvedDimensions {
  width: number;
  height: number;
  aspectRatio: AspectRatioPreset;
}

export const MIN_DIMENSION = 64;
export const MAX_DIMENSION = 4096;
export const MAX_PIXELS = 4_194_304; // 4 Megapixels (e.g. 2048x2048)
export const MIN_CANDIDATE_COUNT = 1;
export const MAX_CANDIDATE_COUNT = 10;
export const MAX_PROMPT_LENGTH = 4000;
export const MAX_ASSET_COUNT = 10;
export const MAX_RESPONSE_SIZE = 1_048_576; // 1 MB
export const MAX_SOURCE_LENGTH = 131_072; // 128 KB
export const MAX_ASSET_BYTES = 5_242_880; // 5 MB
export const MAX_SVG_BYTES = 10_485_760; // 10 MB
export const MAX_RENDER_DURATION_MS = 30_000; // 30 seconds
export const MAX_AST_DEPTH = 64;
export const MAX_AST_NODES = 2000;

export const ASPECT_RATIO_PRESETS: Record<
  Exclude<AspectRatioPreset, "custom">,
  { width: number; height: number }
> = {
  "1:1": { width: 1024, height: 1024 },
  "4:5": { width: 1024, height: 1280 },
  "3:2": { width: 1200, height: 800 },
  "16:9": { width: 1280, height: 720 },
};
