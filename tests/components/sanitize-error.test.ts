import { describe, expect, test } from "bun:test";
import { sanitizeErrorMessage } from "../../src/components/utils/sanitize-error";

describe("sanitizeErrorMessage", () => {
  test("returns friendly fallback on empty/null input", () => {
    expect(sanitizeErrorMessage(null)).toBe("An unknown error occurred.");
    expect(sanitizeErrorMessage("")).toBe("An unknown error occurred.");
    expect(sanitizeErrorMessage("   ")).toBe("An unknown error occurred.");
  });

  test("extracts message from Error object", () => {
    const err = new Error("Something went wrong");
    expect(sanitizeErrorMessage(err)).toBe("Something went wrong");
  });

  test("extracts error message from response JSON object", () => {
    expect(sanitizeErrorMessage({ error: "Session not found" })).toBe(
      "Session not found",
    );
    expect(sanitizeErrorMessage({ message: "Timeout" })).toBe("Timeout");
  });

  test("redacts OpenAI API keys", () => {
    const raw =
      "Request failed with sk-1234567890abcdef1234567890: 401 Unauthorized";
    expect(sanitizeErrorMessage(raw)).toBe(
      "Request failed with [REDACTED_API_KEY]: 401 Unauthorized",
    );
  });

  test("redacts Anthropic API keys", () => {
    const raw =
      "Error: Invalid header x-api-key sk-ant-api03-abcdefghijklmnop1234";
    expect(sanitizeErrorMessage(raw)).toBe(
      "Error: Invalid header x-api-key [REDACTED_API_KEY]",
    );
  });

  test("redacts Bearer tokens", () => {
    const raw =
      "Authorization failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz";
    expect(sanitizeErrorMessage(raw)).toBe(
      "Authorization failed: Bearer [REDACTED_TOKEN]",
    );
  });

  test("redacts query/param credentials", () => {
    const raw =
      "Failed to fetch https://api.example.com/v1?api_key=secretKey123&user=45";
    expect(sanitizeErrorMessage(raw)).toContain("api_key=[REDACTED]");
    expect(sanitizeErrorMessage("token=mySecretToken12345")).toBe(
      "token=[REDACTED]",
    );
  });

  test("redacts absolute file system paths", () => {
    const rawUnix = "Failed to load /home/deploy/renderloom/secret/config.json";
    expect(sanitizeErrorMessage(rawUnix)).toBe("Failed to load [FILE_PATH]");

    const rawMac = "ENOENT: /Users/dokbakar/Projects/file.txt not found";
    expect(sanitizeErrorMessage(rawMac)).toBe("ENOENT: [FILE_PATH] not found");

    const rawWin =
      "Failed at C:\\Users\\Administrator\\AppData\\Local\\config.json";
    expect(sanitizeErrorMessage(rawWin)).toBe("Failed at [FILE_PATH]");
  });

  test("preserves actionable AST, renderer, and domain error messages", () => {
    const astErr = "AST validation failed: Forbidden identifier 'eval'";
    expect(sanitizeErrorMessage(astErr)).toBe(astErr);

    const dimErr = "Dimension mismatch: expected 1024x1024, got 800x600";
    expect(sanitizeErrorMessage(dimErr)).toBe(dimErr);

    const timeoutErr = "Renderer timed out after 30000ms";
    expect(sanitizeErrorMessage(timeoutErr)).toBe(timeoutErr);

    const quotaErr = "Provider quota exceeded (429)";
    expect(sanitizeErrorMessage(quotaErr)).toBe(quotaErr);
  });

  test("redacts multiple leaked secrets in a single error message", () => {
    const combo =
      "Anthropic: sk-ant-api03-abcdefghijklmnop1234, OpenAI: sk-proj-1234567890abcdef123456, Auth: Bearer myToken1234567890";
    const sanitized = sanitizeErrorMessage(combo);
    expect(sanitized).toBe(
      "Anthropic: [REDACTED_API_KEY], OpenAI: [REDACTED_API_KEY], Auth: Bearer [REDACTED_TOKEN]",
    );
    expect(sanitized).not.toContain("sk-ant-");
    expect(sanitized).not.toContain("sk-proj-");
    expect(sanitized).not.toContain("myToken");
  });

  test("redacts system paths across /tmp, /etc, /var, and /usr", () => {
    expect(sanitizeErrorMessage("Failed to read /etc/ssl/certs/ca.pem")).toBe(
      "Failed to read [FILE_PATH]",
    );
    expect(sanitizeErrorMessage("Crash dumped to /tmp/crash-dump.log")).toBe(
      "Crash dumped to [FILE_PATH]",
    );
    expect(sanitizeErrorMessage("Missing binary at /usr/local/bin/resvg")).toBe(
      "Missing binary at [FILE_PATH]",
    );
  });

  test("handles non-standard object error formats via JSON serialization", () => {
    const weirdObj = { code: 500, detail: "sk-abcdefghijklmnopqrstuvwxyz" };
    const sanitized = sanitizeErrorMessage(weirdObj);
    expect(sanitized).toContain("[REDACTED_API_KEY]");
    expect(sanitized).not.toContain("sk-abcdefghijklmnop");
  });
});
