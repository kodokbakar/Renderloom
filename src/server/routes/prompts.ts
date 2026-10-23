import { ValidationError } from "../../domain/errors";
import { composePrompt } from "../../prompts/composer";
import { loadBasePrompt } from "../../prompts/loader";
import type { StyleRegistry } from "../../styles/registry";
import { validateComposePromptRequest } from "../validation";

export async function handlePromptRoute(
  req: Request,
  url: URL,
  styleRegistry: StyleRegistry,
): Promise<Response | null> {
  const pathname = url.pathname;

  try {
    // 1. GET /api/prompts/default
    if (req.method === "GET" && pathname === "/api/prompts/default") {
      const prompt = await loadBasePrompt();
      return Response.json({ prompt });
    }

    // 2. POST /api/prompts/compose
    if (req.method === "POST" && pathname === "/api/prompts/compose") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        throw new ValidationError("Invalid JSON body");
      }

      const valid = validateComposePromptRequest(body);
      try {
        const composed = await composePrompt(valid, { styleRegistry });
        return Response.json({ composed });
      } catch (err) {
        if (
          err instanceof ValidationError &&
          err.message.includes("not found")
        ) {
          return Response.json(
            { error: err.message, code: "STYLE_NOT_FOUND" },
            { status: 404 },
          );
        }
        throw err;
      }
    }

    return null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const details = err instanceof ValidationError ? err.details : undefined;
    return Response.json({ error: message, details }, { status: 400 });
  }
}
