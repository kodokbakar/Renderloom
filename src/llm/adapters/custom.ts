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

export class CustomAdapter implements ProviderAdapter {
  readonly id = "custom";

  readonly meta: ProviderMeta = {
    id: "custom",
    name: "Custom (OpenAI-Compatible)",
    defaultBaseUrl: "http://localhost:11434/v1",
    supportsCustomBaseUrl: true,
    defaultModelId: "llama3",
    models: [
      {
        id: "llama3",
        name: "Llama 3",
        contextWindow: 8192,
        isDefault: true,
      },
      {
        id: "mistral",
        name: "Mistral",
        contextWindow: 32768,
      },
      {
        id: "deepseek-chat",
        name: "DeepSeek Chat",
        contextWindow: 64000,
      },
      {
        id: "qwen2.5-coder",
        name: "Qwen 2.5 Coder",
        contextWindow: 32768,
      },
    ],
  };

  private readonly fetchFn: FetchFunction;

  constructor(options?: { fetchFn?: FetchFunction }) {
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
  }

  private resolveBaseUrl(baseUrl?: string): string {
    const raw = baseUrl?.trim() ? baseUrl.trim() : this.meta.defaultBaseUrl;
    return validateBaseUrl(raw ?? "http://localhost:11434/v1", true);
  }

  async testConnection(
    key: string,
    modelId: string,
    baseUrl?: string,
  ): Promise<ConnectionTestResult> {
    const effectiveBaseUrl = this.resolveBaseUrl(baseUrl);
    const start = performance.now();

    const headers: Record<string, string> = {};
    if (key?.trim()) {
      headers.Authorization = `Bearer ${key.trim()}`;
    }

    try {
      await executeProviderFetch(
        `${effectiveBaseUrl}/models`,
        {
          method: "GET",
          headers,
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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (request.apiKey?.trim()) {
      headers.Authorization = `Bearer ${request.apiKey.trim()}`;
    }

    const response = await executeProviderFetch(
      `${effectiveBaseUrl}/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        fetchFn: this.fetchFn,
        timeoutMs: 60000,
        signal: request.signal,
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
