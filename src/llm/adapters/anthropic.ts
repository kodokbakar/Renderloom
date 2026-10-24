import { ValidationError } from "../../domain/errors";
import type {
  ConnectionTestResult,
  LLMGenerationRequest,
  LLMGenerationResponse,
  ProviderAdapter,
  ProviderMeta,
} from "../../domain/provider";
import { normalizeProviderError } from "../errors";
import { type FetchFunction, executeProviderFetch } from "./base";

export class AnthropicAdapter implements ProviderAdapter {
  readonly id = "anthropic";

  readonly meta: ProviderMeta = {
    id: "anthropic",
    name: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    supportsCustomBaseUrl: false,
    defaultModelId: "claude-3-5-sonnet-20241022",
    models: [
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        contextWindow: 200000,
        isDefault: true,
      },
      {
        id: "claude-3-5-haiku-20241022",
        name: "Claude 3.5 Haiku",
        contextWindow: 200000,
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        contextWindow: 200000,
      },
    ],
  };

  private readonly fetchFn: FetchFunction;

  constructor(options?: { fetchFn?: FetchFunction }) {
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
  }

  private resolveBaseUrl(baseUrl?: string): string {
    if (baseUrl?.trim()) {
      const clean = baseUrl.trim().replace(/\/+$/, "");
      if (
        clean !== "https://api.anthropic.com" &&
        clean !== "https://api.anthropic.com/v1"
      ) {
        throw new ValidationError(
          "Custom base URL is not supported for Anthropic",
        );
      }
    }
    return this.meta.defaultBaseUrl ?? "https://api.anthropic.com/v1";
  }

  async testConnection(
    key: string,
    modelId: string,
    baseUrl?: string,
  ): Promise<ConnectionTestResult> {
    const start = performance.now();

    try {
      const effectiveBaseUrl = this.resolveBaseUrl(baseUrl);
      await executeProviderFetch(
        `${effectiveBaseUrl}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key.trim(),
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: modelId,
            max_tokens: 1,
            messages: [{ role: "user", content: "ping" }],
          }),
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

    const payload: Record<string, unknown> = {
      model: request.modelId,
      max_tokens: request.maxTokens ?? 4096,
      messages: [{ role: "user", content: request.prompt }],
    };

    if (request.systemPrompt) {
      payload.system = request.systemPrompt;
    }
    if (request.temperature !== undefined) {
      payload.temperature = request.temperature;
    }

    const response = await executeProviderFetch(
      `${effectiveBaseUrl}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": request.apiKey.trim(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
        fetchFn: this.fetchFn,
        timeoutMs: 60000,
        signal: request.signal,
      },
      this.id,
    );

    const json = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
      model?: string;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
      };
    };

    const durationMs = Math.round(performance.now() - start);
    const rawText = (json.content ?? [])
      .filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("");

    return {
      rawText,
      modelId: json.model ?? request.modelId,
      usage: json.usage
        ? {
            promptTokens: json.usage.input_tokens,
            completionTokens: json.usage.output_tokens,
            totalTokens:
              (json.usage.input_tokens ?? 0) + (json.usage.output_tokens ?? 0),
          }
        : undefined,
      durationMs,
    };
  }
}
