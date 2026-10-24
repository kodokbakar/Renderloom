import { describe, expect, test } from "bun:test";
import {
  formatCandidateDuration,
  formatTimingDuration,
  getCandidateDuration,
} from "../../src/components/utils/format-timing";

describe("format-timing", () => {
  describe("formatTimingDuration", () => {
    test("handles undefined, null, NaN, and negative numbers with fallback dash", () => {
      expect(formatTimingDuration(undefined)).toBe("—");
      expect(formatTimingDuration(null)).toBe("—");
      expect(formatTimingDuration(Number.NaN)).toBe("—");
      expect(formatTimingDuration(-500)).toBe("—");
    });

    test("formats sub-second durations in milliseconds", () => {
      expect(formatTimingDuration(0)).toBe("0ms");
      expect(formatTimingDuration(250)).toBe("250ms");
      expect(formatTimingDuration(999)).toBe("999ms");
    });

    test("formats durations under 60 seconds with one decimal point", () => {
      expect(formatTimingDuration(1000)).toBe("1.0s");
      expect(formatTimingDuration(1500)).toBe("1.5s");
      expect(formatTimingDuration(28400)).toBe("28.4s");
      expect(formatTimingDuration(59900)).toBe("59.9s");
    });

    test("formats durations over 60 seconds in minutes and seconds", () => {
      expect(formatTimingDuration(60000)).toBe("1m 0s");
      expect(formatTimingDuration(75000)).toBe("1m 15s");
      expect(formatTimingDuration(3661000)).toBe("61m 1s");
    });
  });

  describe("getCandidateDuration", () => {
    test("returns durationMs when explicitly provided and non-negative", () => {
      expect(getCandidateDuration({ durationMs: 4200 })).toBe(4200);
      expect(getCandidateDuration({ durationMs: 0 })).toBe(0);
    });

    test("calculates duration from start and end timestamps if durationMs is absent", () => {
      const timing = {
        generationStartedAt: "2026-10-24T12:00:00.000Z",
        completedAt: "2026-10-24T12:00:03.500Z",
      };
      expect(getCandidateDuration(timing)).toBe(3500);
    });

    test("returns undefined for invalid or missing timestamps", () => {
      expect(getCandidateDuration(undefined)).toBeUndefined();
      expect(
        getCandidateDuration({
          generationStartedAt: "invalid-date",
          completedAt: "2026-10-24T12:00:00.000Z",
        }),
      ).toBeUndefined();
    });
  });

  describe("formatCandidateDuration", () => {
    test("formats valid timing object or returns fallback dash", () => {
      expect(formatCandidateDuration({ durationMs: 1200 })).toBe("1.2s");
      expect(formatCandidateDuration(undefined)).toBe("—");
    });
  });
});
