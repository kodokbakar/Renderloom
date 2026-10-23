import {
  ASPECT_RATIO_PRESETS,
  type AspectRatioPreset,
  MAX_DIMENSION,
  MAX_PIXELS,
  MIN_DIMENSION,
  type ResolvedDimensions,
} from "../domain/dimensions";
import { ValidationError } from "../domain/errors";

export interface ResolveDimensionsOptions {
  aspectRatio?: AspectRatioPreset;
  width?: number;
  height?: number;
}

export function validateDimensionBounds(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new ValidationError(
      `Dimensions must be integers, received width=${width}, height=${height}`,
    );
  }

  if (width < MIN_DIMENSION || width > MAX_DIMENSION) {
    throw new ValidationError(
      `Width must be between ${MIN_DIMENSION} and ${MAX_DIMENSION} pixels, received ${width}`,
    );
  }

  if (height < MIN_DIMENSION || height > MAX_DIMENSION) {
    throw new ValidationError(
      `Height must be between ${MIN_DIMENSION} and ${MAX_DIMENSION} pixels, received ${height}`,
    );
  }

  const totalPixels = width * height;
  if (totalPixels > MAX_PIXELS) {
    throw new ValidationError(
      `Total pixel count (${totalPixels}) exceeds maximum allowed limit of ${MAX_PIXELS} pixels (4 Megapixels)`,
    );
  }
}

export function resolveDimensions(
  options: ResolveDimensionsOptions = {},
): ResolvedDimensions {
  const { aspectRatio, width, height } = options;

  if (aspectRatio && aspectRatio !== "custom") {
    const preset = ASPECT_RATIO_PRESETS[aspectRatio];
    if (!preset) {
      throw new ValidationError(
        `Unknown aspect ratio preset '${aspectRatio}'. Allowed presets: 1:1, 4:5, 3:2, 16:9, custom`,
      );
    }
    // If explicit width or height provided with preset, validate they match or take preset
    const resolvedWidth = width ?? preset.width;
    const resolvedHeight = height ?? preset.height;
    validateDimensionBounds(resolvedWidth, resolvedHeight);
    return {
      width: resolvedWidth,
      height: resolvedHeight,
      aspectRatio,
    };
  }

  // Custom or unspecified aspect ratio
  if (width === undefined || height === undefined) {
    // Default to 1:1 if nothing specified
    const defaultPreset = ASPECT_RATIO_PRESETS["1:1"];
    const resolvedWidth = width ?? defaultPreset.width;
    const resolvedHeight = height ?? defaultPreset.height;
    validateDimensionBounds(resolvedWidth, resolvedHeight);
    return {
      width: resolvedWidth,
      height: resolvedHeight,
      aspectRatio: "1:1",
    };
  }

  validateDimensionBounds(width, height);

  return {
    width,
    height,
    aspectRatio: "custom",
  };
}
