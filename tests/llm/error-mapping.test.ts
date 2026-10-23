import { describe, expect, test } from "bun:test";
import { ProviderError } from "../../src/domain";
import { normalizeProviderError } from "../../src/llm/errors";

describe("Provider Error Normalizer", () => {
  test("maps HTTP 401 to UNAUTHORIZED", () => {
    const err = normalizeProviderError({ status: 401 }, "openai");
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.providerId).toBe("openai");
    expect(err.message).toBe("Invalid or unauthorized API key");
  });

  test("maps HTTP 402 to INSUFFICIENT_QUOTA", () => {
    const err = normalizeProviderError({ status: 402 }, "openai");
    expect(err.code).toBe("INSUFFICIENT_QUOTA");
    expect(err.providerId).toBe("openai");
  });

  test("maps HTTP 429 to RATE_LIMITED", () => {
    const err = normalizeProviderError({ status: 429 }, "anthropic");
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.providerId).toBe("anthropic");
  });

  test("maps HTTP 404 to MODEL_NOT_FOUND", () => {
    const err = normalizeProviderError({ status: 404 }, "openai");
    expect(err.code).toBe("MODEL_NOT_FOUND");
    expect(err.providerId).toBe("openai");
  });

  test("maps HTTP 400 to INVALID_REQUEST", () => {
    const err = normalizeProviderError(
      { status: 400, message: "max_tokens too high" },
      "openai",
    );
    expect(err.code).toBe("INVALID_REQUEST");
    expect(err.message).toContain("max_tokens too high");
  });

  test("maps HTTP 5xx to PROVIDER_ERROR", () => {
    const err500 = normalizeProviderError({ status: 500 }, "openai");
    expect(err500.code).toBe("PROVIDER_ERROR");
    expect(err500.message).toContain("500");

    const err503 = normalizeProviderError({ status: 503 }, "anthropic");
    expect(err503.code).toBe("PROVIDER_ERROR");
    expect(err503.message).toContain("503");
  });

  test("maps AbortError or timeout to TIMEOUT", () => {
    const abortErr = new Error("The operation was aborted");
    abortErr.name = "AbortError";
    const normalized = normalizeProviderError(abortErr, "openai");
    expect(normalized.code).toBe("TIMEOUT");
    expect(normalized.message).toBe("Provider request timed out");
  });

  test("maps fetch connection error to NETWORK_ERROR", () => {
    const fetchErr = new TypeError(
      "fetch failed: ECONNREFUSED 127.0.0.1:11434",
    );
    const normalized = normalizeProviderError(fetchErr, "openai");
    expect(normalized.code).toBe("NETWORK_ERROR");
    expect(normalized.message).toBe("Failed to connect to provider API");
  });

  test("preserves existing ProviderError with redacting", () => {
    const rawSecret = "sk-proj-secret-1234567890abcdef";
    const existing = new ProviderError(
      "INVALID_REQUEST",
      `Bad request with key ${rawSecret}`,
      "openai",
    );
    const normalized = normalizeProviderError(existing, "openai");
    expect(normalized.code).toBe("INVALID_REQUEST");
    expect(normalized.message).not.toContain(rawSecret);
    expect(normalized.message).toContain("[REDACTED]");
  });

  test("redacts secrets inside raw error messages", () => {
    const rawSecret = "sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz";
    const err = new Error(`Authentication failed for key ${rawSecret}`);
    const normalized = normalizeProviderError(err, "anthropic");
    expect(normalized.message).not.toContain(rawSecret);
  });
});
