import type {
  ConnectionTestResult,
  LLMGenerationRequest,
  LLMGenerationResponse,
  ProviderAdapter,
  ProviderMeta,
} from "../../domain/provider";
import { validateBaseUrl } from "../../security/url";
import { normalizeProviderError } from "../errors";
import { type FetchFunction, executeProviderFetch } from "./base";

export class OpenAIAdapter implements ProviderAdapter {
  readonly id = "openai";

  readonly meta: ProviderMeta = {
    id: "openai",
    name: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    supportsCustomBaseUrl: true,
    defaultModelId: "gpt-4o",
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        contextWindow: 128000,
        isDefault: true,
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        contextWindow: 128000,
      },
      {
        id: "o3-mini",
        name: "o3-mini",
        contextWindow: 200000,
      },
    ],
  };

  private readonly fetchFn: FetchFunction;

  constructor(options?: { fetchFn?: FetchFunction }) {
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
  }

  private resolveBaseUrl(baseUrl?: string): string {
    const raw = baseUrl?.trim() ? baseUrl.trim() : this.meta.defaultBaseUrl;
    return validateBaseUrl(raw ?? "https://api.openai.com/v1", true);
  }

  async testConnection(
    key: string,
    modelId: string,
    baseUrl?: string,
  ): Promise<ConnectionTestResult> {
    const effectiveBaseUrl = this.resolveBaseUrl(baseUrl);
    const start = performance.now();

    try {
      await executeProviderFetch(
        `${effectiveBaseUrl}/models`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${key.trim()}`,
          },
          fetchFn: this.fetchFn,
          timeoutMs: 15000,
        },
        this.id,
      );

      const latencyMs = Math.round(performance.now() - start);
      return {
        success: true,
        latencyMs,
        modelId,
      };
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - start);
      const normalized = normalizeProviderError(err, this.id);
      return {
        success: false,
        latencyMs,
        error: normalized.message,
        code: normalized.code,
        modelId,
      };
    }
  }

  async generate(
    request: LLMGenerationRequest,
  ): Promise<LLMGenerationResponse> {
    const effectiveBaseUrl = this.resolveBaseUrl(request.baseUrl);
    const start = performance.now();

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    messages.push({ role: "user", content: request.prompt });

    const payload: Record<string, unknown> = {
      model: request.modelId,
      messages,
    };

    if (request.temperature !== undefined) {
      payload.temperature = request.temperature;
    }
    if (request.maxTokens !== undefined) {
      payload.max_tokens = request.maxTokens;
    }

    const response = await executeProviderFetch(
      `${effectiveBaseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${request.apiKey.trim()}`,
        },
        body: JSON.stringify(payload),
        fetchFn: this.fetchFn,
        timeoutMs: 60000,
      },
      this.id,
    );

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const durationMs = Math.round(performance.now() - start);
    const rawText = json.choices?.[0]?.message?.content ?? "";

    return {
      rawText,
      modelId: json.model ?? request.modelId,
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined,
      durationMs,
    };
  }
}
