export function sanitizeErrorMessage(error: unknown): string {
  if (!error) {
    return "An unknown error occurred.";
  }

  let message = "";
  if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, unknown>;
    if (typeof errObj.message === "string") {
      message = errObj.message;
    } else if (typeof errObj.error === "string") {
      message = errObj.error;
    } else {
      try {
        message = JSON.stringify(error);
      } catch {
        message = String(error);
      }
    }
  } else {
    message = String(error);
  }

  if (!message || !message.trim()) {
    return "An unknown error occurred.";
  }

  let sanitized = message;

  // 1. Redact Anthropic API keys (sk-ant-...)
  sanitized = sanitized.replace(
    /sk-ant-[a-zA-Z0-9_\-]{8,}/gi,
    "[REDACTED_API_KEY]",
  );

  // 2. Redact OpenAI / generic API keys (sk-proj-..., sk-...)
  sanitized = sanitized.replace(
    /sk-(?:proj-)?[a-zA-Z0-9_\-]{16,}/gi,
    "[REDACTED_API_KEY]",
  );

  // 3. Redact Bearer tokens
  sanitized = sanitized.replace(
    /Bearer\s+[a-zA-Z0-9_\-.~+/=]{10,}/gi,
    "Bearer [REDACTED_TOKEN]",
  );

  // 4. Redact query/header parameters (api_key=..., secret=..., token=..., password=...)
  sanitized = sanitized.replace(
    /(api[_-]?key|secret|token|password|auth|authorization)=([^\s&"'>]+)/gi,
    "$1=[REDACTED]",
  );

  // 5. Redact absolute filesystem paths (/home/..., /Users/..., /var/..., C:\...)
  // We keep filename or replace full path with [FILE_PATH]
  sanitized = sanitized.replace(
    /(?:[a-zA-Z]:\\|\/(?:home|Users|var|tmp|etc|usr|opt|private)\/)[^\s"':;,]+/g,
    "[FILE_PATH]",
  );

  // 6. Clean up extra whitespace
  sanitized = sanitized.trim();

  return sanitized;
}
