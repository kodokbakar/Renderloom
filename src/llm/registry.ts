import { ValidationError } from "../domain/errors";
import type { ProviderAdapter, ProviderMeta } from "../domain/provider";
import { AnthropicAdapter } from "./adapters/anthropic";
import type { FetchFunction } from "./adapters/base";
import { OpenAIAdapter } from "./adapters/openai";
export class ProviderRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();

  constructor(options?: {
    adapters?: ProviderAdapter[];
    fetchFn?: FetchFunction;
  }) {
    if (options?.adapters) {
      for (const adapter of options.adapters) {
        this.register(adapter);
      }
    } else {
      this.register(new OpenAIAdapter({ fetchFn: options?.fetchFn }));
      this.register(new AnthropicAdapter({ fetchFn: options?.fetchFn }));
    }
  }

  register(adapter: ProviderAdapter): void {
    if (!adapter?.id) {
      throw new ValidationError("Adapter must have a valid id");
    }
    this.adapters.set(adapter.id.toLowerCase(), adapter);
  }

  get(providerId: string): ProviderAdapter | undefined {
    if (!providerId) return undefined;
    return this.adapters.get(providerId.toLowerCase());
  }

  has(providerId: string): boolean {
    if (!providerId) return false;
    return this.adapters.has(providerId.toLowerCase());
  }

  list(): ProviderMeta[] {
    return Array.from(this.adapters.values()).map((a) => a.meta);
  }

  clear(): void {
    this.adapters.clear();
  }
}
