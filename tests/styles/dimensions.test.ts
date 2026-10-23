import { describe, expect, test } from "bun:test";
import { ValidationError } from "../../src/domain/errors";
import {
  resolveDimensions,
  validateDimensionBounds,
} from "../../src/styles/dimensions";

describe("Aspect Ratio Resolution & Dimension Bounds", () => {
  test("resolves standard 1:1 preset", () => {
    const res = resolveDimensions({ aspectRatio: "1:1" });
    expect(res).toEqual({
      width: 1024,
      height: 1024,
      aspectRatio: "1:1",
    });
  });

  test("resolves standard 4:5 preset", () => {
    const res = resolveDimensions({ aspectRatio: "4:5" });
    expect(res).toEqual({
      width: 1024,
      height: 1280,
      aspectRatio: "4:5",
    });
  });

  test("resolves standard 3:2 preset", () => {
    const res = resolveDimensions({ aspectRatio: "3:2" });
    expect(res).toEqual({
      width: 1200,
      height: 800,
      aspectRatio: "3:2",
    });
  });

  test("resolves standard 16:9 preset", () => {
    const res = resolveDimensions({ aspectRatio: "16:9" });
    expect(res).toEqual({
      width: 1280,
      height: 720,
      aspectRatio: "16:9",
    });
  });

  test("resolves custom dimensions", () => {
    const res = resolveDimensions({ width: 800, height: 600 });
    expect(res).toEqual({
      width: 800,
      height: 600,
      aspectRatio: "custom",
    });
  });

  test("defaults to 1:1 when no options provided", () => {
    const res = resolveDimensions();
    expect(res).toEqual({
      width: 1024,
      height: 1024,
      aspectRatio: "1:1",
    });
  });

  test("rejects dimensions below MIN_DIMENSION (64)", () => {
    expect(() => validateDimensionBounds(63, 1024)).toThrow(ValidationError);
    expect(() => validateDimensionBounds(1024, 0)).toThrow(ValidationError);
    expect(() => validateDimensionBounds(-100, 1024)).toThrow(ValidationError);
  });

  test("rejects dimensions above MAX_DIMENSION (4096)", () => {
    expect(() => validateDimensionBounds(4097, 1024)).toThrow(ValidationError);
    expect(() => validateDimensionBounds(1024, 5000)).toThrow(ValidationError);
  });

  test("rejects total pixels exceeding MAX_PIXELS (4,194,304)", () => {
    // 3000 * 3000 = 9,000,000 pixels (> 4.19M)
    expect(() => validateDimensionBounds(3000, 3000)).toThrow(ValidationError);
    // 2048 * 2048 = 4,194,304 pixels (exactly max) - should pass
    expect(() => validateDimensionBounds(2048, 2048)).not.toThrow();
  });

  test("rejects non-integer dimensions", () => {
    expect(() => validateDimensionBounds(1024.5, 768)).toThrow(ValidationError);
    expect(() => validateDimensionBounds(800, 600.25)).toThrow(ValidationError);
  });

  test("rejects unknown aspect ratio preset", () => {
    expect(() =>
      // @ts-expect-error Testing invalid runtime input
      resolveDimensions({ aspectRatio: "99:99" }),
    ).toThrow(ValidationError);
  });

  test("enforces exact pixel ceiling boundaries (4,194,304 vs 4,194,305+)", () => {
    // Exactly 4,194,304 pixels with max width
    expect(() => validateDimensionBounds(4096, 1024)).not.toThrow();
    // Exactly 4,194,304 pixels with max height
    expect(() => validateDimensionBounds(1024, 4096)).not.toThrow();

    // Exceeding 4,194,304 by one height increment
    expect(() => validateDimensionBounds(4096, 1025)).toThrow(ValidationError);
    // Exceeding 4,194,304 by one width increment
    expect(() => validateDimensionBounds(1025, 4096)).toThrow(ValidationError);
  });

  test("enforces exact dimension floor and ceiling boundaries (64 and 4096)", () => {
    // Minimum allowed 64x64
    expect(() => validateDimensionBounds(64, 64)).not.toThrow();
    // Below minimum
    expect(() => validateDimensionBounds(63, 64)).toThrow(ValidationError);
    expect(() => validateDimensionBounds(64, 63)).toThrow(ValidationError);

    // Maximum allowed 4096
    expect(() => validateDimensionBounds(4096, 64)).not.toThrow();
    expect(() => validateDimensionBounds(64, 4096)).not.toThrow();
    // Above maximum
    expect(() => validateDimensionBounds(4097, 64)).toThrow(ValidationError);
    expect(() => validateDimensionBounds(64, 4097)).toThrow(ValidationError);
  });
});
