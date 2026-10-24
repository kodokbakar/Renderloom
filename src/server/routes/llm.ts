import { ProviderError, ValidationError } from "../../domain/errors";
import { normalizeProviderError } from "../../llm/errors";
import type { InMemoryKeyStore } from "../../llm/keystore";
import type { ProviderRegistry } from "../../llm/registry";
import { maskApiKey } from "../../security/mask";
import { redactSecrets } from "../../security/redact";
import { validateBaseUrl } from "../../security/url";
import {
  validateSetKeyRequest,
  validateTestConnectionRequest,
} from "../validation";

export async function handleLlmRoute(
  req: Request,
  url: URL,
  keyStore: InMemoryKeyStore,
  registry: ProviderRegistry,
): Promise<Response | null> {
  const pathname = url.pathname;

  try {
    // 1. GET /api/llm/providers
    if (req.method === "GET" && pathname === "/api/llm/providers") {
      const providers = registry.list();
      const statusMap = keyStore.getStatus();
      const enriched = providers.map((meta) => ({
        ...meta,
        status: statusMap[meta.id] ?? { configured: false },
      }));
      return Response.json({ providers: enriched });
    }

    // 2. GET /api/llm/keys/status
    if (req.method === "GET" && pathname === "/api/llm/keys/status") {
      return Response.json({ status: keyStore.getStatus() });
    }

    // 3. POST /api/llm/keys
    if (req.method === "POST" && pathname === "/api/llm/keys") {
      const body = await req.json();
      const valid = validateSetKeyRequest(body);

      const adapter = registry.get(valid.providerId);
      if (!adapter) {
        throw new ValidationError(`Unknown provider '${valid.providerId}'`);
      }

      let validatedBaseUrl: string | undefined;
      if (valid.baseUrl) {
        if (!adapter.meta.supportsCustomBaseUrl) {
          throw new ValidationError(
            `Custom base URL is not supported for ${adapter.meta.name}`,
          );
        }
        validatedBaseUrl = validateBaseUrl(valid.baseUrl, true);
      }

      keyStore.setKey(valid.providerId, valid.apiKey ?? "", validatedBaseUrl);

      return Response.json({
        success: true,
        providerId: valid.providerId,
        maskedKey: valid.apiKey?.trim()
          ? maskApiKey(valid.apiKey)
          : "No API key required",
        baseUrl: validatedBaseUrl,
        status: "held_in_memory",
      });
    }

    // 4. DELETE /api/llm/keys/:providerId
    const deleteMatch = pathname.match(/^\/api\/llm\/keys\/([^/]+)$/);
    if (req.method === "DELETE" && deleteMatch) {
      const rawId = deleteMatch[1] ?? "";
      const providerId = decodeURIComponent(rawId).toLowerCase();
      const deleted = keyStore.deleteKey(providerId);

      return Response.json({
        success: deleted,
        providerId,
      });
    }

    // 5. POST /api/llm/test-connection
    if (req.method === "POST" && pathname === "/api/llm/test-connection") {
      const body = await req.json();
      const valid = validateTestConnectionRequest(body);

      const adapter = registry.get(valid.providerId);
      if (!adapter) {
        throw new ValidationError(`Unknown provider '${valid.providerId}'`);
      }

      const stored = keyStore.getKey(valid.providerId);
      const effectiveKey = valid.apiKey?.trim() || stored?.apiKey || "";

      if (!effectiveKey && valid.providerId.toLowerCase() !== "custom") {
        throw new ValidationError(
          `No API key provided or configured for provider '${valid.providerId}'`,
        );
      }

      let effectiveBaseUrl = valid.baseUrl?.trim() || stored?.baseUrl;
      if (effectiveBaseUrl) {
        if (!adapter.meta.supportsCustomBaseUrl) {
          throw new ValidationError(
            `Custom base URL is not supported for ${adapter.meta.name}`,
          );
        }
        effectiveBaseUrl = validateBaseUrl(effectiveBaseUrl, true);
      }

      const result = await adapter.testConnection(
        effectiveKey,
        valid.modelId,
        effectiveBaseUrl,
      );

      if (!result.success) {
        return Response.json(
          {
            success: false,
            error: redactSecrets(result.error ?? "Connection failed"),
            code: result.code ?? "PROVIDER_ERROR",
            latencyMs: result.latencyMs,
            modelId: result.modelId,
          },
          { status: 400 },
        );
      }

      return Response.json(result);
    }

    return null;
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      return Response.json(
        {
          error: redactSecrets(err.message),
          details: err.details,
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    if (err instanceof ProviderError) {
      return Response.json(
        {
          error: redactSecrets(err.message),
          code: err.code,
          details: err.details,
        },
        { status: 400 },
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        error: redactSecrets(message),
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}
