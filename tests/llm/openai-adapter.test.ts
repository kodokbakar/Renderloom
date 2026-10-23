import { describe, expect, test } from "bun:test";
import type { FetchFunction } from "../../src/llm/adapters/base";
import { OpenAIAdapter } from "../../src/llm/adapters/openai";

describe("OpenAI Adapter", () => {
  test("metadata reports capabilities correctly", () => {
    const adapter = new OpenAIAdapter();
    expect(adapter.id).toBe("openai");
    expect(adapter.meta.supportsCustomBaseUrl).toBe(true);
    expect(adapter.meta.defaultModelId).toBe("gpt-4o");
    expect(adapter.meta.models.length).toBeGreaterThan(0);
  });

  test("testConnection succeeds on HTTP 200", async () => {
    const mockFetch: FetchFunction = async (url, init) => {
      expect(String(url)).toBe("https://api.openai.com/v1/models");
      expect(init?.headers).toBeDefined();
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer sk-valid-key");

      return new Response(
        JSON.stringify({
          data: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const adapter = new OpenAIAdapter({ fetchFn: mockFetch });
    const result = await adapter.testConnection("sk-valid-key", "gpt-4o");

    expect(result.success).toBe(true);
    expect(result.modelId).toBe("gpt-4o");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  test("testConnection supports custom base URL", async () => {
    const customUrl = "http://localhost:11434/v1";
    const mockFetch: FetchFunction = async (url) => {
      expect(String(url)).toBe("http://localhost:11434/v1/models");
      return new Response(JSON.stringify({ data: [{ id: "llama3" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const adapter = new OpenAIAdapter({ fetchFn: mockFetch });
    const result = await adapter.testConnection(
      "sk-custom-key",
      "llama3",
      customUrl,
    );

    expect(result.success).toBe(true);
  });

  test("testConnection returns normalized failure on HTTP 401", async () => {
    const mockFetch: FetchFunction = async () => {
      return new Response(
        JSON.stringify({
          error: { message: "Incorrect API key provided" },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    };

    const adapter = new OpenAIAdapter({ fetchFn: mockFetch });
    const result = await adapter.testConnection("sk-invalid-key", "gpt-4o");

    expect(result.success).toBe(false);
    expect(result.code).toBe("UNAUTHORIZED");
    expect(result.error).toBe("Invalid or unauthorized API key");
  });

  test("generate successfully parses response and usage", async () => {
    const mockFetch: FetchFunction = async (_url, init) => {
      const body = JSON.parse(init?.body as string);
      expect(body.model).toBe("gpt-4o");
      expect(body.messages.length).toBe(2);
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[1].content).toBe("Draw a card");

      return new Response(
        JSON.stringify({
          model: "gpt-4o-2024-08-06",
          choices: [
            {
              message: { content: "<Card>Rendered design</Card>" },
            },
          ],
          usage: {
            prompt_tokens: 120,
            completion_tokens: 45,
            total_tokens: 165,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const adapter = new OpenAIAdapter({ fetchFn: mockFetch });
    const res = await adapter.generate({
      prompt: "Draw a card",
      systemPrompt: "You are a designer",
      modelId: "gpt-4o",
      apiKey: "sk-test-key",
    });

    expect(res.rawText).toBe("<Card>Rendered design</Card>");
    expect(res.modelId).toBe("gpt-4o-2024-08-06");
    expect(res.usage?.promptTokens).toBe(120);
    expect(res.usage?.completionTokens).toBe(45);
    expect(res.usage?.totalTokens).toBe(165);
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });
});
