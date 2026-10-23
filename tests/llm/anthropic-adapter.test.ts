import { describe, expect, test } from "bun:test";
import { AnthropicAdapter } from "../../src/llm/adapters/anthropic";
import type { FetchFunction } from "../../src/llm/adapters/base";

describe("Anthropic Adapter", () => {
  test("metadata reports capabilities correctly", () => {
    const adapter = new AnthropicAdapter();
    expect(adapter.id).toBe("anthropic");
    expect(adapter.meta.supportsCustomBaseUrl).toBe(false);
    expect(adapter.meta.defaultModelId).toBe("claude-3-5-sonnet-20241022");
    expect(adapter.meta.models.length).toBeGreaterThan(0);
  });

  test("rejects arbitrary custom base URL", async () => {
    const adapter = new AnthropicAdapter();
    const result = await adapter.testConnection(
      "sk-ant-test",
      "claude-3-5-sonnet-20241022",
      "https://custom-proxy.example.com",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Custom base URL is not supported");
  });

  test("testConnection sends single-token ping and headers", async () => {
    const mockFetch: FetchFunction = async (url, init) => {
      expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
      const headers = init?.headers as Record<string, string>;
      expect(headers["x-api-key"]).toBe("sk-ant-valid-key");
      expect(headers["anthropic-version"]).toBe("2023-06-01");

      const body = JSON.parse(init?.body as string);
      expect(body.max_tokens).toBe(1);
      expect(body.messages[0].content).toBe("ping");

      return new Response(
        JSON.stringify({
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "pong" }],
          model: "claude-3-5-sonnet-20241022",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const adapter = new AnthropicAdapter({ fetchFn: mockFetch });
    const result = await adapter.testConnection(
      "sk-ant-valid-key",
      "claude-3-5-sonnet-20241022",
    );

    expect(result.success).toBe(true);
    expect(result.modelId).toBe("claude-3-5-sonnet-20241022");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  test("testConnection returns normalized failure on rate limit HTTP 429", async () => {
    const mockFetch: FetchFunction = async () => {
      return new Response(
        JSON.stringify({
          type: "error",
          error: {
            type: "rate_limit_error",
            message:
              "Number of request tokens has exceeded your per-minute rate limit",
          },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    };

    const adapter = new AnthropicAdapter({ fetchFn: mockFetch });
    const result = await adapter.testConnection(
      "sk-ant-valid-key",
      "claude-3-5-sonnet-20241022",
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe("RATE_LIMITED");
  });

  test("generate parses content blocks and usage", async () => {
    const mockFetch: FetchFunction = async (_url, init) => {
      const body = JSON.parse(init?.body as string);
      expect(body.system).toBe("System prompt here");
      expect(body.messages[0].content).toBe("User design prompt");

      return new Response(
        JSON.stringify({
          id: "msg_999",
          model: "claude-3-5-sonnet-20241022",
          content: [{ type: "text", text: "<svg>Anthropic Design</svg>" }],
          usage: {
            input_tokens: 85,
            output_tokens: 32,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const adapter = new AnthropicAdapter({ fetchFn: mockFetch });
    const response = await adapter.generate({
      prompt: "User design prompt",
      systemPrompt: "System prompt here",
      modelId: "claude-3-5-sonnet-20241022",
      apiKey: "sk-ant-valid-key",
    });

    expect(response.rawText).toBe("<svg>Anthropic Design</svg>");
    expect(response.usage?.promptTokens).toBe(85);
    expect(response.usage?.completionTokens).toBe(32);
    expect(response.usage?.totalTokens).toBe(117);
    expect(response.durationMs).toBeGreaterThanOrEqual(0);
  });
});
