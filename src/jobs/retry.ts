import { ProviderError, RenderError, ValidationError } from "../domain/errors";

export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  // Caller cancellation must never be retried
  if (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.message.toLowerCase().includes("cancelled") ||
      error.message.toLowerCase().includes("aborted"))
  ) {
    return false;
  }

  // Permanent validation or render failures must never be retried
  if (error instanceof ValidationError) {
    return false;
  }

  if (error instanceof RenderError) {
    return false;
  }

  // Provider errors classification
  if (error instanceof ProviderError) {
    switch (error.code) {
      case "RATE_LIMITED":
      case "TIMEOUT":
      case "NETWORK_ERROR":
      case "PROVIDER_ERROR":
        return true;
      default:
        return false;
    }
  }

  // Common network/fetch errors
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("fetch failed") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("enotfound") ||
      msg.includes("network error")
    ) {
      return true;
    }
  }

  return false;
}

export function calculateBackoff(
  attempt: number,
  baseMs = 500,
  maxMs = 5000,
): number {
  if (attempt <= 0) return 0;
  const backoff = baseMs * 2 ** (attempt - 1);
  return Math.min(backoff, maxMs);
}

export function sleepWithAbort(
  ms: number,
  signal?: AbortSignal,
): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();

  if (signal?.aborted) {
    const err = new Error("Sleep aborted by caller");
    err.name = "AbortError";
    reject(err);
    return promise;
  }

  if (ms <= 0) {
    resolve();
    return promise;
  }

  const timer = setTimeout(() => {
    signal?.removeEventListener("abort", onAbort);
    resolve();
  }, ms);

  const onAbort = () => {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    const err = new Error("Sleep aborted by caller");
    err.name = "AbortError";
    reject(err);
  };

  signal?.addEventListener("abort", onAbort, { once: true });

  return promise;
}
