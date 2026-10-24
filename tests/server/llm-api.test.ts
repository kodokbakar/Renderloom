import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import type { FetchFunction } from "../../src/llm/adapters/base";
import { InMemoryKeyStore } from "../../src/llm/keystore";
import { ProviderRegistry } from "../../src/llm/registry";
import { createServer } from "../../src/server/server";

describe("LLM API Routes", () => {
  let server: Server<unknown>;
  let baseUrl: string;
  let keyStore: InMemoryKeyStore;
  let registry: ProviderRegistry;

  beforeAll(() => {
    keyStore = new InMemoryKeyStore();

    // Mock fetch for adapters inside registry
    const mockFetch: FetchFunction = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/models")) {
        return new Response(JSON.stringify({ data: [{ id: "test-model" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (urlStr.includes("anthropic.com/v1/messages")) {
        return new Response(
          JSON.stringify({
            id: "msg_test",
            content: [{ type: "text", text: "pong" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("Not found", { status: 404 });
    };

    registry = new ProviderRegistry({ fetchFn: mockFetch });

    server = createServer({
      port: 0,
      keyStore,
      providerRegistry: registry,
    });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(() => {
    server.stop(true);
  });

  test("GET /api/llm/providers lists supported providers and initial key status", async () => {
    const res = await fetch(`${baseUrl}/api/llm/providers`);
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      providers: Array<{
        id: string;
        name: string;
        supportsCustomBaseUrl?: boolean;
        status: { configured: boolean };
      }>;
    };
    expect(json.providers.length).toBeGreaterThanOrEqual(2);

    const openai = json.providers.find((p) => p.id === "openai");
    expect(openai).toBeDefined();
    expect(openai?.status.configured).toBe(false);

    const custom = json.providers.find((p) => p.id === "custom");
    expect(custom).toBeDefined();
    expect(custom?.status.configured).toBe(false);
    expect(custom?.supportsCustomBaseUrl).toBe(true);
  });
  test("POST /api/llm/keys sets transient key and returns masked indicator", async () => {
    const rawKey = "sk-proj-super-secret-key-1234567890";
    const res = await fetch(`${baseUrl}/api/llm/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "openai",
        apiKey: rawKey,
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      maskedKey: string;
      status: string;
    };
    expect(json.success).toBe(true);
    expect(json.status).toBe("held_in_memory");
    expect(json.maskedKey).toBe("sk-...7890");

    // Key in memory
    expect(keyStore.hasKey("openai")).toBe(true);

    // Verify status endpoint reflects masked key
    const statusRes = await fetch(`${baseUrl}/api/llm/keys/status`);
    const statusJson = (await statusRes.json()) as {
      status: Record<string, { configured: boolean; maskedKey: string }>;
    };
    const openaiStatus = statusJson.status.openai;
    expect(openaiStatus).toBeDefined();
    expect(openaiStatus?.configured).toBe(true);
    expect(openaiStatus?.maskedKey).toBe("sk-...7890");
    expect(JSON.stringify(statusJson)).not.toContain(rawKey);
  });
  test("POST /api/llm/keys allows empty/missing apiKey for custom provider", async () => {
    const res = await fetch(`${baseUrl}/api/llm/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "custom",
        baseUrl: "http://localhost:11434/v1",
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      maskedKey: string;
      baseUrl: string;
    };
    expect(json.success).toBe(true);
    expect(json.maskedKey).toBe("No API key required");
    expect(json.baseUrl).toBe("http://localhost:11434/v1");
    expect(keyStore.hasKey("custom")).toBe(true);
  });

  test("POST /api/llm/keys blocks cloud metadata SSRF on custom baseUrl", async () => {
    const res = await fetch(`${baseUrl}/api/llm/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "custom",
        baseUrl: "http://169.254.169.254/v1",
      }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain(
      "Access to cloud metadata endpoints is forbidden",
    );
  });

  test("POST /api/llm/keys rejects unsupported custom base URL for Anthropic", async () => {
    const res = await fetch(`${baseUrl}/api/llm/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "anthropic",
        apiKey: "sk-ant-test-key-12345",
        baseUrl: "https://custom.anthropic.com",
      }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain(
      "Custom base URL is not supported for Anthropic",
    );
  });

  test("POST /api/llm/test-connection uses in-memory key when not provided in body", async () => {
    const res = await fetch(`${baseUrl}/api/llm/test-connection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "openai",
        modelId: "gpt-4o",
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; modelId: string };
    expect(json.success).toBe(true);
    expect(json.modelId).toBe("gpt-4o");
  });
  test("POST /api/llm/test-connection succeeds with empty apiKey for custom provider", async () => {
    const res = await fetch(`${baseUrl}/api/llm/test-connection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "custom",
        modelId: "llama3",
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; modelId: string };
    expect(json.success).toBe(true);
    expect(json.modelId).toBe("llama3");
  });

  test("DELETE /api/llm/keys/:providerId purges key from memory", async () => {
    const delRes = await fetch(`${baseUrl}/api/llm/keys/openai`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(200);

    const delJson = (await delRes.json()) as { success: boolean };
    expect(delJson.success).toBe(true);
    expect(keyStore.hasKey("openai")).toBe(false);

    // Subsequent test-connection without key fails
    const testRes = await fetch(`${baseUrl}/api/llm/test-connection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "openai",
        modelId: "gpt-4o",
      }),
    });
    expect(testRes.status).toBe(400);
  });

  test("purging key mid-flight does not affect running request but blocks subsequent requests", async () => {
    // 1. Set key
    keyStore.setKey("openai", "sk-valid-key");

    // 2. Start connection test
    const activeTestPromise = fetch(`${baseUrl}/api/llm/test-connection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "openai",
        modelId: "gpt-4o",
      }),
    });

    // 3. Purge key immediately
    const delRes = await fetch(`${baseUrl}/api/llm/keys/openai`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(200);

    // 4. In-flight request finishes cleanly
    const activeRes = await activeTestPromise;
    expect(activeRes.status).toBe(200);

    // 5. Subsequent request has no key and fails
    const subsequentRes = await fetch(`${baseUrl}/api/llm/test-connection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "openai",
        modelId: "gpt-4o",
      }),
    });
    expect(subsequentRes.status).toBe(400);
    const errJson = (await subsequentRes.json()) as { error: string };
    expect(errJson.error).toContain("No API key provided or configured");
  });

  test("rejects malformed requests missing required fields", async () => {
    const res = await fetch(`${baseUrl}/api/llm/test-connection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { code: string };
    expect(json.code).toBe("VALIDATION_ERROR");
  });
});
