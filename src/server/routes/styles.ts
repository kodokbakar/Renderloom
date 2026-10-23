import { ValidationError } from "../../domain/errors";
import type { StyleRegistry } from "../../styles/registry";

export async function handleStyleRoute(
  req: Request,
  url: URL,
  registry: StyleRegistry,
): Promise<Response | null> {
  const pathname = url.pathname;

  try {
    // 1. GET /api/styles
    if (req.method === "GET" && pathname === "/api/styles") {
      const styles = await registry.listPresets();
      return Response.json({ styles });
    }

    // 2. GET /api/styles/:id
    const match = pathname.match(/^\/api\/styles\/([a-zA-Z0-9_-]+)$/);
    if (req.method === "GET" && match && match[1]) {
      const styleId = match[1];
      try {
        const style = await registry.getPreset(styleId);
        return Response.json({ style });
      } catch (err) {
        if (err instanceof ValidationError) {
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
    return Response.json({ error: message }, { status: 400 });
  }
}
