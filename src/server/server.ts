import { ValidationError } from "../domain/errors";
import { GenerationCoordinator } from "../jobs/coordinator";
import { InMemoryKeyStore } from "../llm/keystore";
import { ProviderRegistry } from "../llm/registry";
import { SessionService } from "../sessions/service";
import { StyleRegistry } from "../styles/registry";
import { handleDimensionRoute } from "./routes/dimensions";
import { handleJobRoute } from "./routes/jobs";
import { handleLlmRoute } from "./routes/llm";
import { handlePromptRoute } from "./routes/prompts";
import { handleSessionRoute } from "./routes/sessions";
import { handleStyleRoute } from "./routes/styles";
import { validateGenerationRequest } from "./validation";
export interface ServerOptions {
  port?: number;
  sessionService?: SessionService;
  keyStore?: InMemoryKeyStore;
  providerRegistry?: ProviderRegistry;
  styleRegistry?: StyleRegistry;
  coordinator?: GenerationCoordinator;
}

export function createServer(
  portOrOptions: number | ServerOptions = 3000,
  injectedService?: SessionService,
) {
  const port =
    typeof portOrOptions === "number"
      ? portOrOptions
      : (portOrOptions.port ?? 3000);

  const sessionService =
    injectedService ??
    (typeof portOrOptions === "object"
      ? portOrOptions.sessionService
      : undefined) ??
    new SessionService();

  const keyStore =
    (typeof portOrOptions === "object" ? portOrOptions.keyStore : undefined) ??
    new InMemoryKeyStore();

  const providerRegistry =
    (typeof portOrOptions === "object"
      ? portOrOptions.providerRegistry
      : undefined) ?? new ProviderRegistry();

  const styleRegistry =
    (typeof portOrOptions === "object"
      ? portOrOptions.styleRegistry
      : undefined) ?? new StyleRegistry();

  const coordinator =
    (typeof portOrOptions === "object"
      ? portOrOptions.coordinator
      : undefined) ??
    new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });
  return Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === "GET" && url.pathname === "/api/health") {
        return Response.json({
          status: "ok",
          name: "renderloom",
          version: "0.1.0",
        });
      }

      if (
        req.method === "POST" &&
        url.pathname === "/api/validate-generation"
      ) {
        try {
          const body = await req.json();
          const valid = validateGenerationRequest(body);
          const hasStyle = await styleRegistry.hasPreset(valid.styleId);
          if (!hasStyle) {
            return Response.json(
              { valid: false, error: `Unknown styleId '${valid.styleId}'` },
              { status: 400 },
            );
          }
          return Response.json({ valid: true, data: valid });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          const details =
            err instanceof ValidationError ? err.details : undefined;
          return Response.json(
            { valid: false, error: message, details },
            { status: 400 },
          );
        }
      }

      const sessionResponse = await handleSessionRoute(
        req,
        url,
        sessionService,
      );

      const llmResponse = await handleLlmRoute(
        req,
        url,
        keyStore,
        providerRegistry,
      );

      const styleResponse = await handleStyleRoute(req, url, styleRegistry);
      if (styleResponse) {
        return styleResponse;
      }

      const dimensionResponse = await handleDimensionRoute(req, url);
      if (dimensionResponse) {
        return dimensionResponse;
      }

      const promptResponse = await handlePromptRoute(req, url, styleRegistry);
      if (promptResponse) {
        return promptResponse;
      }
      if (llmResponse) {
        return llmResponse;
      }
      if (sessionResponse) {
        return sessionResponse;
      }

      const jobResponse = await handleJobRoute(
        req,
        url,
        coordinator,
        sessionService,
      );
      if (jobResponse) {
        return jobResponse;
      }

      return new Response("Not Found", { status: 404 });
    },
  });
}
