import { ProviderError, type ProviderErrorCode } from "../domain/errors";
import { redactSecrets, sanitizeObject } from "../security/redact";

export interface ExtractedErrorInfo {
  status?: number;
  message?: string;
  code?: string;
  details?: unknown;
}

export function extractErrorInfo(error: unknown): ExtractedErrorInfo {
  if (!error) return {};

  if (typeof error === "string") {
    return { message: redactSecrets(error) };
  }

  if (error instanceof Error) {
    const info: ExtractedErrorInfo = {
      message: redactSecrets(error.message),
    };

    if ("status" in error && typeof error.status === "number") {
      info.status = error.status;
    }
    if ("code" in error && typeof error.code === "string") {
      info.code = error.code;
    }
    if ("details" in error) {
      info.details = sanitizeObject(error.details);
    }

    return info;
  }

  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;
    const status = typeof obj.status === "number" ? obj.status : undefined;
    const message =
      typeof obj.message === "string" ? redactSecrets(obj.message) : undefined;
    const code = typeof obj.code === "string" ? obj.code : undefined;
    const details = obj.details ? sanitizeObject(obj.details) : undefined;

    return { status, message, code, details };
  }

  return { message: redactSecrets(String(error)) };
}

export function normalizeProviderError(
  error: unknown,
  providerId: string,
): ProviderError {
  if (error instanceof ProviderError) {
    return new ProviderError(
      error.code,
      redactSecrets(error.message),
      error.providerId || providerId,
      error.details ? sanitizeObject(error.details) : undefined,
    );
  }

  const { status, message: rawMessage, details } = extractErrorInfo(error);
  const errName = error instanceof Error ? error.name : "";
  const errMessage = (rawMessage ?? "").toLowerCase();

  // 1. Timeout detection
  if (
    errName === "TimeoutError" ||
    errName === "AbortError" ||
    errMessage.includes("timeout") ||
    errMessage.includes("timed out") ||
    errMessage.includes("aborted")
  ) {
    return new ProviderError(
      "TIMEOUT",
      "Provider request timed out",
      providerId,
      details,
    );
  }

  // 2. HTTP Status Code mapping
  if (status === 401) {
    return new ProviderError(
      "UNAUTHORIZED",
      "Invalid or unauthorized API key",
      providerId,
      details,
    );
  }

  if (status === 402) {
    return new ProviderError(
      "INSUFFICIENT_QUOTA",
      "Insufficient quota or billing credits",
      providerId,
      details,
    );
  }

  if (status === 429) {
    return new ProviderError(
      "RATE_LIMITED",
      "Provider rate limit exceeded",
      providerId,
      details,
    );
  }

  if (status === 404) {
    return new ProviderError(
      "MODEL_NOT_FOUND",
      "Model not found or unavailable for this provider",
      providerId,
      details,
    );
  }

  if (status === 400) {
    const msg = rawMessage
      ? `Invalid request: ${rawMessage}`
      : "Invalid request parameters";
    return new ProviderError(
      "INVALID_REQUEST",
      redactSecrets(msg),
      providerId,
      details,
    );
  }

  if (status && status >= 500) {
    return new ProviderError(
      "PROVIDER_ERROR",
      `Provider service unavailable (HTTP ${status})`,
      providerId,
      details,
    );
  }

  // 3. Network / Connection errors
  if (
    errName === "TypeError" ||
    errName === "FetchError" ||
    errMessage.includes("fetch failed") ||
    errMessage.includes("econnrefused") ||
    errMessage.includes("enotfound") ||
    errMessage.includes("network error") ||
    errMessage.includes("connection refused")
  ) {
    return new ProviderError(
      "NETWORK_ERROR",
      "Failed to connect to provider API",
      providerId,
      details,
    );
  }

  // 4. Message content heuristics if status was not set
  if (
    errMessage.includes("unauthorized") ||
    errMessage.includes("invalid api key")
  ) {
    return new ProviderError(
      "UNAUTHORIZED",
      "Invalid or unauthorized API key",
      providerId,
      details,
    );
  }

  if (errMessage.includes("quota") || errMessage.includes("billing")) {
    return new ProviderError(
      "INSUFFICIENT_QUOTA",
      "Insufficient quota or billing credits",
      providerId,
      details,
    );
  }

  if (
    errMessage.includes("rate limit") ||
    errMessage.includes("too many requests")
  ) {
    return new ProviderError(
      "RATE_LIMITED",
      "Provider rate limit exceeded",
      providerId,
      details,
    );
  }

  if (
    errMessage.includes("model_not_found") ||
    errMessage.includes("does not exist")
  ) {
    return new ProviderError(
      "MODEL_NOT_FOUND",
      "Model not found or unavailable for this provider",
      providerId,
      details,
    );
  }

  // 5. Fallback generic provider error
  const finalMessage = rawMessage
    ? redactSecrets(rawMessage)
    : "An unexpected provider error occurred";

  return new ProviderError("PROVIDER_ERROR", finalMessage, providerId, details);
}
