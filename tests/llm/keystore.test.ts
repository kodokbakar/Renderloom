import { describe, expect, test } from "bun:test";
import { ValidationError } from "../../src/domain";
import { InMemoryKeyStore } from "../../src/llm/keystore";

describe("InMemoryKeyStore", () => {
  test("stores and retrieves API key and baseUrl", () => {
    const store = new InMemoryKeyStore();
    store.setKey(
      "openai",
      "sk-test-1234567890abcdef",
      "https://api.openai.com/v1",
    );

    expect(store.hasKey("openai")).toBe(true);
    const retrieved = store.getKey("openai");
    expect(retrieved).toBeDefined();
    expect(retrieved?.apiKey).toBe("sk-test-1234567890abcdef");
    expect(retrieved?.baseUrl).toBe("https://api.openai.com/v1");
  });

  test("provider IDs are case-insensitive", () => {
    const store = new InMemoryKeyStore();
    store.setKey("OpenAI", "sk-test-key-123");

    expect(store.hasKey("openai")).toBe(true);
    expect(store.hasKey("OPENAI")).toBe(true);
    expect(store.getKey("openai")?.apiKey).toBe("sk-test-key-123");
  });

  test("getStatus returns masked key and never exposes raw key", () => {
    const store = new InMemoryKeyStore();
    const rawKey = "sk-proj-secret-1234567890-abcdef";
    store.setKey("openai", rawKey, "https://api.openai.com/v1");

    const status = store.getStatus();
    const openaiStatus = status.openai;
    expect(openaiStatus).toBeDefined();
    expect(openaiStatus?.configured).toBe(true);
    expect(openaiStatus?.baseUrl).toBe("https://api.openai.com/v1");
    expect(openaiStatus?.maskedKey).toBe("sk-...cdef");
    expect(
      (openaiStatus as unknown as Record<string, unknown>).apiKey,
    ).toBeUndefined();

    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain(rawKey);
  });

  test("deleteKey removes provider entry", () => {
    const store = new InMemoryKeyStore();
    store.setKey("anthropic", "sk-ant-test-key-999");
    expect(store.hasKey("anthropic")).toBe(true);

    const deleted = store.deleteKey("anthropic");
    expect(deleted).toBe(true);
    expect(store.hasKey("anthropic")).toBe(false);
    expect(store.getKey("anthropic")).toBeUndefined();
    expect(store.deleteKey("anthropic")).toBe(false);
  });

  test("clear wipes all keys", () => {
    const store = new InMemoryKeyStore();
    store.setKey("openai", "sk-test-1");
    store.setKey("anthropic", "sk-test-2");

    expect(Object.keys(store.getStatus()).length).toBe(2);
    store.clear();
    expect(Object.keys(store.getStatus()).length).toBe(0);
    expect(store.hasKey("openai")).toBe(false);
    expect(store.hasKey("anthropic")).toBe(false);
  });

  test("rejects empty providerId or apiKey", () => {
    const store = new InMemoryKeyStore();
    expect(() => store.setKey("", "some-key")).toThrow(ValidationError);
    expect(() => store.setKey("openai", "")).toThrow(ValidationError);
    expect(() => store.setKey("openai", "   ")).toThrow(ValidationError);
  });

  test("handles concurrent updates and status consistency across providers", async () => {
    const store = new InMemoryKeyStore();
    const providers = ["openai", "anthropic", "custom-1", "custom-2"];

    await Promise.all(
      providers.map(async (p, idx) => {
        store.setKey(p, `sk-concurrent-key-${idx}-${p}`);
      }),
    );

    const status = store.getStatus();
    for (const p of providers) {
      expect(store.hasKey(p)).toBe(true);
      expect(status[p]).toBeDefined();
      expect(status[p]?.configured).toBe(true);
    }

    // Interleaved concurrent overwrite and delete
    await Promise.all([
      store.setKey("openai", "sk-new-key-111"),
      store.deleteKey("custom-1"),
      store.setKey("custom-2", "sk-new-key-222"),
    ]);

    expect(store.hasKey("custom-1")).toBe(false);
    expect(store.hasKey("openai")).toBe(true);
    expect(store.hasKey("custom-2")).toBe(true);
    expect(store.getKey("openai")?.apiKey).toBe("sk-new-key-111");
  });
});
