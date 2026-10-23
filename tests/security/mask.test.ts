import { describe, expect, test } from "bun:test";
import { maskApiKey } from "../../src/security/mask";

describe("API Key Masking Utility", () => {
  test("masks standard OpenAI keys correctly", () => {
    const key = "sk-proj-1234567890abcdef1234567890";
    const masked = maskApiKey(key);
    expect(masked).toBe("sk-...7890");
    expect(masked).not.toContain("1234567890abcdef");
  });

  test("masks standard Anthropic keys correctly", () => {
    const key = "sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz-ABCD";
    const masked = maskApiKey(key);
    expect(masked).toBe("sk-ant-...ABCD");
    expect(masked).not.toContain("1234567890abcdef");
  });

  test("masks short keys with ***", () => {
    expect(maskApiKey("short")).toBe("***");
    expect(maskApiKey("12345678")).toBe("***");
  });

  test("masks medium-short keys between 9 and 12 chars", () => {
    expect(maskApiKey("123456789")).toBe("12...89");
    expect(maskApiKey("123456789012")).toBe("12...12");
  });

  test("handles empty and whitespace strings", () => {
    expect(maskApiKey("")).toBe("");
    expect(maskApiKey("   ")).toBe("");
    expect(maskApiKey(null as unknown as string)).toBe("");
    expect(maskApiKey(undefined as unknown as string)).toBe("");
  });
});
