import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { Server } from "bun";
import type { FetchFunction } from "../../src/llm/adapters/base";
import { OpenAIAdapter } from "../../src/llm/adapters/openai";
import { normalizeProviderError } from "../../src/llm/errors";
import { InMemoryKeyStore } from "../../src/llm/keystore";
import { ProviderRegistry } from "../../src/llm/registry";
import { createServer } from "../../src/server/server";

describe("Sentinel Secret-Leak Verification", () => {
  const SENTINEL_KEY = "sk-test-SENTINEL-DO-NOT-LEAK-SECRET-XYZ9876543210";
  let server: Server<unknown>;
  let baseUrl: string;
  let keyStore: InMemoryKeyStore;

  beforeAll(() => {
    keyStore = new InMemoryKeyStore();

    // Mock fetch that reflects the API key back in error responses to test leak prevention
    const mockFetch: FetchFunction = async (_url, init) => {
      const authHeader =
        (init?.headers as Record<string, string>)?.Authorization ?? "";
      return new Response(
        JSON.stringify({
          error: {
            message: `Authentication failed for key: ${authHeader}`,
            code: "invalid_api_key",
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    };

    const registry = new ProviderRegistry({ fetchFn: mockFetch });

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

  test("keystore getStatus() never leaks sentinel key", () => {
    keyStore.setKey("openai", SENTINEL_KEY);
    const status = keyStore.getStatus();
    const serialized = JSON.stringify(status);

    expect(serialized).not.toContain(SENTINEL_KEY);
    expect(serialized).toContain("sk-...3210");
  });

  test("error normalizer scrubs sentinel key from error payloads", () => {
    const rawError = {
      status: 401,
      message: `Unauthorized access using token ${SENTINEL_KEY}`,
      details: {
        attemptedToken: SENTINEL_KEY,
        debug: `Failed key: ${SENTINEL_KEY}`,
      },
    };

    const normalized = normalizeProviderError(rawError, "openai");
    expect(normalized.message).not.toContain(SENTINEL_KEY);

    const serializedDetails = JSON.stringify(normalized.details ?? {});
    expect(serializedDetails).not.toContain(SENTINEL_KEY);
  });

  test("adapter connection failure scrubs reflected sentinel key", async () => {
    const mockReflectingFetch: FetchFunction = async () => {
      return new Response(
        JSON.stringify({
          error: `Invalid credentials: ${SENTINEL_KEY}`,
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    };

    const adapter = new OpenAIAdapter({ fetchFn: mockReflectingFetch });
    const result = await adapter.testConnection(SENTINEL_KEY, "gpt-4o");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).not.toContain(SENTINEL_KEY);
  });

  test("API test-connection endpoint scrubs reflected sentinel key", async () => {
    const res = await fetch(`${baseUrl}/api/llm/test-connection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "openai",
        modelId: "gpt-4o",
        apiKey: SENTINEL_KEY,
      }),
    });

    expect(res.status).toBe(400);
    const rawBody = await res.text();
    expect(rawBody).not.toContain(SENTINEL_KEY);
  });

  test("API keys endpoints never return sentinel key in response payloads", async () => {
    // 1. Set key
    const setRes = await fetch(`${baseUrl}/api/llm/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "openai",
        apiKey: SENTINEL_KEY,
      }),
    });
    const setBody = await setRes.text();
    expect(setBody).not.toContain(SENTINEL_KEY);
    expect(setBody).toContain("sk-...3210");

    // 2. Providers status
    const provRes = await fetch(`${baseUrl}/api/llm/providers`);
    const provBody = await provRes.text();
    expect(provBody).not.toContain(SENTINEL_KEY);

    // 3. Status endpoint
    const statusRes = await fetch(`${baseUrl}/api/llm/keys/status`);
    const statusBody = await statusRes.text();
    expect(statusBody).not.toContain(SENTINEL_KEY);
  });

  test("filesystem check: Outputs directory never contains sentinel key", () => {
    const outputsDir = path.resolve(__dirname, "../../Outputs");
    if (!existsSync(outputsDir)) {
      return;
    }

    function checkDir(dir: string) {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          checkDir(fullPath);
        } else if (stat.isFile()) {
          const content = readFileSync(fullPath, "utf-8");
          expect(content).not.toContain(SENTINEL_KEY);
        }
      }
    }

    checkDir(outputsDir);
  });

  test("error normalizer scrubs sentinel keys deeply nested in arrays and objects", () => {
    const deepError = {
      status: 400,
      message: `Failed request at https://api.openai.com/v1?token=${SENTINEL_KEY}`,
      details: {
        errors: [
          {
            context: {
              authorization: `Bearer ${SENTINEL_KEY}`,
              rawKey: SENTINEL_KEY,
              hints: [`check key ${SENTINEL_KEY}`],
            },
          },
        ],
      },
    };

    const normalized = normalizeProviderError(deepError, "openai");
    expect(normalized.message).not.toContain(SENTINEL_KEY);

    const serialized = JSON.stringify(normalized);
    expect(serialized).not.toContain(SENTINEL_KEY);
  });
});
