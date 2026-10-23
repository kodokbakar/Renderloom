import { describe, expect, test } from "bun:test";
import { ValidationError } from "../../src/domain";
import {
  assertNoSecrets,
  containsSecret,
  redactSecrets,
  sanitizeObject,
} from "../../src/security";

describe("Secret Redaction Guard", () => {
  const fakeOpenAiKey = "sk-proj-abc1234567890defghijklmnopqrstuvwxyz";
  const fakeAnthropicKey = "sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz";
  const fakeGoogleKey = "AIzaSyD-1234567890abcdefghijklmnopqrstuv";
  const fakeBearer = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID";

  test("containsSecret detects known key patterns", () => {
    expect(containsSecret(fakeOpenAiKey)).toBe(true);
    expect(containsSecret(fakeAnthropicKey)).toBe(true);
    expect(containsSecret(fakeGoogleKey)).toBe(true);
    expect(containsSecret(fakeBearer)).toBe(true);
    expect(containsSecret("api_key: secret-1234567890123456")).toBe(true);
    expect(containsSecret("Safe text without credentials")).toBe(false);
  });

  test("redactSecrets masks tokens with [REDACTED]", () => {
    const raw = `Connecting with ${fakeOpenAiKey} and ${fakeGoogleKey}`;
    const cleaned = redactSecrets(raw);
    expect(cleaned).not.toContain(fakeOpenAiKey);
    expect(cleaned).not.toContain(fakeGoogleKey);
    expect(cleaned).toContain("[REDACTED]");
  });

  test("sanitizeObject recursively cleans objects and arrays", () => {
    const sensitive = {
      apiKey: fakeOpenAiKey,
      nested: {
        authorization: fakeBearer,
        prompt: `Use prompt with key ${fakeAnthropicKey}`,
      },
      tags: ["tag1", fakeGoogleKey],
    };

    const sanitized = sanitizeObject(sensitive);
    expect(sanitized.apiKey).toBe("[REDACTED]");
    expect(sanitized.nested.authorization).toBe("[REDACTED]");
    expect(sanitized.nested.prompt).toContain("[REDACTED]");
    expect(sanitized.nested.prompt).not.toContain(fakeAnthropicKey);
    expect(sanitized.tags[1]).toBe("[REDACTED]");
  });

  test("assertNoSecrets throws ValidationError when secrets are present", () => {
    expect(() => {
      assertNoSecrets({ apiKey: fakeOpenAiKey });
    }).toThrow(ValidationError);

    expect(() => {
      assertNoSecrets({ prompt: `prompt with ${fakeAnthropicKey}` });
    }).toThrow(ValidationError);

    expect(() => {
      assertNoSecrets({
        session: { name: "Safe Name", id: "123", width: 800 },
      });
    }).not.toThrow();
  });
});
