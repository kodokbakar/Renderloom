import { ValidationError } from "../domain/errors";

const SECRET_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9_\-]{20,}/g, // OpenAI / general sk- tokens
  /sk-ant-[a-zA-Z0-9_\-]{20,}/g, // Anthropic API keys
  /AIza[0-9A-Za-z\-_]{35,}/g, // Google API keys
  /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, // Bearer tokens
  /(?:x-api-key|api[_-]?key|secret|token|password)\s*[:=]\s*["']?[a-zA-Z0-9_\-\.]{16,}["']?/gi,
];

const SENSITIVE_KEY_NAMES: Record<string, true> = {
  apikey: true,
  api_key: true,
  secret: true,
  token: true,
  authorization: true,
  auth: true,
  password: true,
  credential: true,
  credentials: true,
  "x-api-key": true,
  x_api_key: true,
};

export function containsSecret(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(input);
  });
}

export function redactSecrets(input: string): string {
  if (!input || typeof input !== "string") return input;
  let redacted = input;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted;
}

export function sanitizeObject<T>(input: T): T {
  if (input === null || typeof input !== "object") {
    if (typeof input === "string") {
      return redactSecrets(input) as unknown as T;
    }
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeObject(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEY_NAMES[lowerKey]) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = sanitizeObject(value);
    }
  }

  return result as T;
}

export function assertNoSecrets(value: unknown, context = "value"): void {
  if (value === null || value === undefined) return;

  if (typeof value === "string") {
    if (containsSecret(value)) {
      throw new ValidationError(`Secret detected in ${context}`);
    }
    return;
  }

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        assertNoSecrets(value[i], `${context}[${i}]`);
      }
      return;
    }

    for (const [key, val] of Object.entries(value)) {
      const lowerKey = key.toLowerCase();
      if (
        SENSITIVE_KEY_NAMES[lowerKey] &&
        typeof val === "string" &&
        val.length > 0
      ) {
        throw new ValidationError(
          `Sensitive key '${key}' detected in ${context}`,
        );
      }
      assertNoSecrets(val, `${context}.${key}`);
    }
  }
}
