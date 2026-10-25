import { SessionError, ValidationError } from "../../domain/errors";
import type { SessionService } from "../../sessions/service";
import {
  ArtifactParamsSchema,
  validateCreateSessionRequest,
  validateRenameSessionRequest,
  validateUpdateSessionRequest,
} from "../validation";

export async function handleSessionRoute(
  req: Request,
  url: URL,
  service: SessionService,
): Promise<Response | null> {
  const pathname = url.pathname;

  try {
    // 1. GET /api/sessions
    if (req.method === "GET" && pathname === "/api/sessions") {
      const sessions = await service.listSessions();
      return Response.json({ sessions });
    }

    // 2. POST /api/sessions
    if (req.method === "POST" && pathname === "/api/sessions") {
      const body = await req.json();
      const valid = validateCreateSessionRequest(body);
      const session = await service.createSession(valid, valid.initialPrompt);
      return Response.json({ session }, { status: 201 });
    }

    // 6. GET /api/sessions/:id/artifacts/:type/:filename
    const artifactMatch = pathname.match(
      /^\/api\/sessions\/([^/]+)\/artifacts\/([^/]+)\/([^/]+)$/,
    );
    if (req.method === "GET" && artifactMatch) {
      const [, rawId, rawType, rawFilename] = artifactMatch;
      const parseResult = ArtifactParamsSchema.safeParse({
        id: decodeURIComponent(rawId ?? ""),
        type: decodeURIComponent(rawType ?? ""),
        filename: decodeURIComponent(rawFilename ?? ""),
      });

      if (!parseResult.success) {
        return Response.json(
          { error: "Invalid artifact request parameters" },
          { status: 400 },
        );
      }

      const { id, type, filename } = parseResult.data;
      const { filePath, mimeType } = await service.getArtifactPath(
        id,
        type,
        filename,
      );

      const file = Bun.file(filePath);
      return new Response(file, {
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `inline; filename="${filename}"`,
        },
      });
    }

    // 3. GET /api/sessions/:id
    const sessionMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (sessionMatch) {
      const rawId = sessionMatch[1] ?? "";
      const id = decodeURIComponent(rawId);

      if (req.method === "GET") {
        const fullSession = await service.getSession(id);
        return Response.json(fullSession);
      }

      // 4. PATCH /api/sessions/:id
      if (req.method === "PATCH") {
        const body = await req.json();
        const updates = validateUpdateSessionRequest(body);
        const session = await service.updateSession(id, updates);
        return Response.json({ session });
      }

      // 5. DELETE /api/sessions/:id
      if (req.method === "DELETE") {
        await service.deleteSession(id);
        return Response.json({ success: true });
      }
    }

    return null; // Not a session route
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      return Response.json(
        { error: err.message, details: err.details },
        { status: 400 },
      );
    }

    if (err instanceof SessionError) {
      switch (err.code) {
        case "SESSION_NOT_FOUND":
        case "ARTIFACT_NOT_FOUND":
          return Response.json({ error: err.message }, { status: 404 });
        case "INVALID_PATH":
        case "INVALID_SESSION_NAME":
          return Response.json({ error: err.message }, { status: 400 });
        case "SESSION_ALREADY_EXISTS":
        case "IMMUTABLE_ARTIFACT":
          return Response.json({ error: err.message }, { status: 409 });
        default:
          return Response.json({ error: err.message }, { status: 500 });
      }
    }

    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
