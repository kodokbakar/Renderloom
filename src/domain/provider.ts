export type ProviderId = "openai" | "anthropic" | (string & {});

export interface ProviderModel {
  id: string;
  name: string;
  contextWindow?: number;
  isDefault?: boolean;
}

export interface ProviderMeta {
  id: string;
  name: string;
  defaultBaseUrl?: string;
  supportsCustomBaseUrl: boolean;
  defaultModelId: string;
  models: ProviderModel[];
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  error?: string;
  code?: string;
  modelId: string;
}

export interface LLMGenerationRequest {
  prompt: string;
  systemPrompt?: string;
  modelId: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMGenerationResponse {
  rawText: string;
  modelId: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  durationMs: number;
}

export interface ProviderAdapter {
  readonly id: string;
  readonly meta: ProviderMeta;
  testConnection(
    key: string,
    modelId: string,
    baseUrl?: string,
  ): Promise<ConnectionTestResult>;
  generate(request: LLMGenerationRequest): Promise<LLMGenerationResponse>;
}
