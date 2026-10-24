import { describe, expect, test } from "bun:test";
import {
  ProviderError,
  RenderError,
  ValidationError,
} from "../../src/domain/errors";
import {
  calculateBackoff,
  isRetryableError,
  sleepWithAbort,
} from "../../src/jobs/retry";

describe("Retry classifier and backoff", () => {
  describe("isRetryableError", () => {
    test("identifies transient provider errors as retryable", () => {
      expect(
        isRetryableError(
          new ProviderError("RATE_LIMITED", "Too many requests"),
        ),
      ).toBe(true);
      expect(
        isRetryableError(new ProviderError("TIMEOUT", "Request timed out")),
      ).toBe(true);
      expect(
        isRetryableError(
          new ProviderError("NETWORK_ERROR", "Connection reset"),
        ),
      ).toBe(true);
      expect(
        isRetryableError(
          new ProviderError("PROVIDER_ERROR", "503 Service Unavailable"),
        ),
      ).toBe(true);
      expect(isRetryableError(new Error("fetch failed"))).toBe(true);
      expect(isRetryableError(new Error("connect ECONNRESET"))).toBe(true);
    });

    test("identifies permanent errors as non-retryable", () => {
      expect(
        isRetryableError(new ProviderError("UNAUTHORIZED", "Bad key")),
      ).toBe(false);
      expect(
        isRetryableError(new ProviderError("INSUFFICIENT_QUOTA", "No credits")),
      ).toBe(false);
      expect(
        isRetryableError(new ProviderError("MODEL_NOT_FOUND", "Missing model")),
      ).toBe(false);
      expect(
        isRetryableError(new ProviderError("INVALID_REQUEST", "Bad params")),
      ).toBe(false);

      expect(isRetryableError(new ValidationError("Invalid JSX"))).toBe(false);
      expect(
        isRetryableError(new RenderError("UNSUPPORTED_SYNTAX", "Syntax error")),
      ).toBe(false);
      expect(
        isRetryableError(
          new RenderError("DANGEROUS_CODE_DETECTED", "eval disallowed"),
        ),
      ).toBe(false);

      const abortError = new Error("Request cancelled by caller");
      abortError.name = "AbortError";
      expect(isRetryableError(abortError)).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  describe("calculateBackoff", () => {
    test("calculates exponential delays with cap", () => {
      expect(calculateBackoff(0, 500, 5000)).toBe(0);
      expect(calculateBackoff(1, 500, 5000)).toBe(500);
      expect(calculateBackoff(2, 500, 5000)).toBe(1000);
      expect(calculateBackoff(3, 500, 5000)).toBe(2000);
      expect(calculateBackoff(4, 500, 5000)).toBe(4000);
      expect(calculateBackoff(5, 500, 5000)).toBe(5000); // capped
      expect(calculateBackoff(6, 500, 5000)).toBe(5000); // capped
    });
  });

  describe("sleepWithAbort", () => {
    test("resolves immediately when ms <= 0", async () => {
      await expect(sleepWithAbort(0)).resolves.toBeUndefined();
      await expect(sleepWithAbort(-10)).resolves.toBeUndefined();
    });

    test("rejects immediately if signal already aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(sleepWithAbort(10000, controller.signal)).rejects.toThrow(
        "Sleep aborted by caller",
      );
    });

    test("aborts immediately when signal triggered during wait", async () => {
      const controller = new AbortController();
      const promise = sleepWithAbort(60000, controller.signal);
      controller.abort();
      await expect(promise).rejects.toThrow("Sleep aborted by caller");
    });
  });
});
