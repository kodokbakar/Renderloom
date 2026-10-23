import { ValidationError } from "../domain/errors";
import { validateGenerationRequest } from "./validation";

export function createServer(port = 3000) {
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

      return new Response("Not Found", { status: 404 });
    },
  });
}
