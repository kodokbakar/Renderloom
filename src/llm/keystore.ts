import { ValidationError } from "../domain/errors";
import { maskApiKey } from "../security/mask";

export interface StoredKeyConfig {
  apiKey: string;
  baseUrl?: string;
  updatedAt: Date;
}

export interface KeyStatusInfo {
  configured: boolean;
  maskedKey?: string;
  baseUrl?: string;
  updatedAt?: string;
}

export class InMemoryKeyStore {
  private readonly store = new Map<string, StoredKeyConfig>();

  setKey(providerId: string, apiKey: string, baseUrl?: string): void {
    if (!providerId || typeof providerId !== "string") {
      throw new ValidationError("providerId must be a non-empty string");
    }

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
      throw new ValidationError("apiKey must be a non-empty string");
    }

    this.store.set(providerId.toLowerCase(), {
      apiKey: apiKey.trim(),
      baseUrl: baseUrl?.trim() ? baseUrl.trim() : undefined,
      updatedAt: new Date(),
    });
  }

  getKey(providerId: string): { apiKey: string; baseUrl?: string } | undefined {
    if (!providerId) return undefined;
    const item = this.store.get(providerId.toLowerCase());
    if (!item) return undefined;
    return {
      apiKey: item.apiKey,
      baseUrl: item.baseUrl,
    };
  }

  hasKey(providerId: string): boolean {
    if (!providerId) return false;
    return this.store.has(providerId.toLowerCase());
  }

  deleteKey(providerId: string): boolean {
    if (!providerId) return false;
    return this.store.delete(providerId.toLowerCase());
  }

  getStatus(): Record<string, KeyStatusInfo> {
    const result: Record<string, KeyStatusInfo> = {};
    for (const [providerId, entry] of this.store.entries()) {
      result[providerId] = {
        configured: true,
        maskedKey: maskApiKey(entry.apiKey),
        baseUrl: entry.baseUrl,
        updatedAt: entry.updatedAt.toISOString(),
      };
    }
    return result;
  }

  clear(): void {
    this.store.clear();
  }
}
