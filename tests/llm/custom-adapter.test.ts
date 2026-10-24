import { describe, expect, test } from "bun:test";
import { ValidationError } from "../../src/domain/errors";
import type { FetchFunction } from "../../src/llm/adapters/base";
import { CustomAdapter } from "../../src/llm/adapters/custom";

describe("Custom Adapter", () => {
  test("metadata reports capabilities correctly", () => {
    const adapter = new CustomAdapter();
    expect(adapter.id).toBe("custom");
    expect(adapter.meta.name).toBe("Custom (OpenAI-Compatible)");
    expect(adapter.meta.supportsCustomBaseUrl).toBe(true);
    expect(adapter.meta.defaultBaseUrl).toBe("http://localhost:11434/v1");
    expect(adapter.meta.defaultModelId).toBe("llama3");

    const modelIds = adapter.meta.models.map((m) => m.id);
    expect(modelIds).toContain("llama3");
    expect(modelIds).toContain("mistral");
    expect(modelIds).toContain("deepseek-chat");
    expect(modelIds).toContain("qwen2.5-coder");
  });

  test("testConnection succeeds on HTTP 200 without Authorization header when key is empty", async () => {
    let capturedHeaders: HeadersInit | undefined;
    let capturedUrl: string | undefined;

    const mockFetch: FetchFunction = async (url, init) => {
      capturedUrl = String(url);
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify({ data: [{ id: "llama3" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const adapter = new CustomAdapter({ fetchFn: mockFetch });
    const result = await adapter.testConnection("", "llama3");

    expect(result.success).toBe(true);
    expect(result.modelId).toBe("llama3");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(capturedUrl).toBe("http://localhost:11434/v1/models");
    expect(
      (capturedHeaders as Record<string, string>)?.Authorization,
    ).toBeUndefined();
  });

  test("testConnection includes Authorization header when key is provided", async () => {
    let capturedHeaders: HeadersInit | undefined;

    const mockFetch: FetchFunction = async (_url, init) => {
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify({ data: [{ id: "deepseek-chat" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const adapter = new CustomAdapter({ fetchFn: mockFetch });
    const result = await adapter.testConnection(
      "sk-custom-secret",
      "deepseek-chat",
      "https://api.deepseek.com/v1",
    );

    expect(result.success).toBe(true);
    expect((capturedHeaders as Record<string, string>)?.Authorization).toBe(
      "Bearer sk-custom-secret",
    );
  });

  test("testConnection handles normalized HTTP error codes", async () => {
    const mockFetch401: FetchFunction = async () => {
      return new Response(
        JSON.stringify({
          error: {
            message: "Invalid API key provided",
            type: "invalid_request_error",
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    };

    const adapter = new CustomAdapter({ fetchFn: mockFetch401 });
    const result = await adapter.testConnection("bad-key", "llama3");

    expect(result.success).toBe(false);
    expect(result.code).toBe("UNAUTHORIZED");
    expect(result.error).toContain("Invalid or unauthorized API key");
  });

  test("testConnection handles HTML error body cleanly", async () => {
    const mockFetch502: FetchFunction = async () => {
      return new Response("<html><body>502 Bad Gateway</body></html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      });
    };

    const adapter = new CustomAdapter({ fetchFn: mockFetch502 });
    const result = await adapter.testConnection("", "llama3");

    expect(result.success).toBe(false);
    expect(result.code).toBe("PROVIDER_ERROR");
  });

  test("testConnection rejects cloud metadata baseUrl via SSRF protection", async () => {
    const adapter = new CustomAdapter();
    expect(
      adapter.testConnection("", "llama3", "http://169.254.169.254/v1"),
    ).rejects.toThrow(ValidationError);
  });

  test("generate formats request, omits Authorization when key is empty, and parses response", async () => {
    let capturedUrl: string | undefined;
    let capturedBody: string | undefined;
    let capturedHeaders: HeadersInit | undefined;

    const mockFetch: FetchFunction = async (url, init) => {
      capturedUrl = String(url);
      capturedBody = String(init?.body);
      capturedHeaders = init?.headers;

      return new Response(
        JSON.stringify({
          id: "chatcmpl-123",
          model: "llama3",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "<svg><circle cx='50' cy='50' r='40'/></svg>",
              },
            },
          ],
          usage: {
            prompt_tokens: 15,
            completion_tokens: 30,
            total_tokens: 45,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const adapter = new CustomAdapter({ fetchFn: mockFetch });
    const response = await adapter.generate({
      prompt: "Create an icon",
      systemPrompt: "You are an SVG designer",
      modelId: "llama3",
      apiKey: "",
      baseUrl: "http://localhost:11434/v1",
      temperature: 0.7,
      maxTokens: 512,
    });

    expect(capturedUrl).toBe("http://localhost:11434/v1/chat/completions");
    expect(
      (capturedHeaders as Record<string, string>)?.Authorization,
    ).toBeUndefined();

    const parsedBody = JSON.parse(capturedBody ?? "{}");
    expect(parsedBody.model).toBe("llama3");
    expect(parsedBody.temperature).toBe(0.7);
    expect(parsedBody.max_tokens).toBe(512);
    expect(parsedBody.messages).toEqual([
      { role: "system", content: "You are an SVG designer" },
      { role: "user", content: "Create an icon" },
    ]);

    expect(response.rawText).toContain("<svg><circle");
    expect(response.modelId).toBe("llama3");
    expect(response.usage?.totalTokens).toBe(45);
    expect(response.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("generate includes Authorization when key is provided", async () => {
    let capturedHeaders: HeadersInit | undefined;

    const mockFetch: FetchFunction = async (_url, init) => {
      capturedHeaders = init?.headers;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "ok" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const adapter = new CustomAdapter({ fetchFn: mockFetch });
    await adapter.generate({
      prompt: "Hello",
      modelId: "mistral",
      apiKey: "sk-mistral-key",
      baseUrl: "https://api.mistral.ai/v1",
    });

    expect((capturedHeaders as Record<string, string>)?.Authorization).toBe(
      "Bearer sk-mistral-key",
    );
  });

  test("generate aborts when AbortSignal triggers", async () => {
    const controller = new AbortController();
    const mockFetch: FetchFunction = async (_url, init) => {
      const { promise, reject } = Promise.withResolvers<Response>();
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted", "AbortError"));
      });
      return promise;
    };

    const adapter = new CustomAdapter({ fetchFn: mockFetch });
    const promise = adapter.generate({
      prompt: "Test abort",
      modelId: "llama3",
      apiKey: "",
      signal: controller.signal,
    });

    controller.abort();
    expect(promise).rejects.toThrow();
  });
});
