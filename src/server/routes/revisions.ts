import {
  ProviderError,
  RenderError,
  SessionError,
  ValidationError,
} from "../../domain/errors";
import type { GenerationCoordinator } from "../../jobs/coordinator";
import { redactSecrets } from "../../security/redact";
import type { SessionService } from "../../sessions/service";
import { validateReviseCandidateRequest } from "../validation";

export async function handleRevisionRoute(
  req: Request,
  url: URL,
  coordinator: GenerationCoordinator,
  sessionService: SessionService,
): Promise<Response | null> {
  const pathname = url.pathname;

  // 1. POST /api/sessions/:id/candidates/:candidateId/revisions
  const reviseMatch = pathname.match(
    /^\/api\/sessions\/([^/]+)\/candidates\/([^/]+)\/revisions$/,
  );
  if (req.method === "POST" && reviseMatch) {
    const sessionId = decodeURIComponent(reviseMatch[1] ?? "");
    const candidateId = decodeURIComponent(reviseMatch[2] ?? "");

    try {
      const body = await req.json();
      const valid = validateReviseCandidateRequest(body);
      const result = await coordinator.reviseCandidate({
        sessionId,
        candidateId,
        prompt: valid.prompt,
        parentVersionId: valid.parentVersionId,
        providerId: valid.providerId,
        modelId: valid.modelId,
        apiKey: valid.apiKey,
        baseUrl: valid.baseUrl,
        temperature: valid.temperature,
      });

      return Response.json(result, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        const isNotFound = err.message.toLowerCase().includes("not found");
        return Response.json(
          { error: err.message, details: err.details },
          { status: isNotFound ? 404 : 400 },
        );
      }
      if (err instanceof SessionError) {
        const status =
          err.code === "SESSION_NOT_FOUND" || err.code === "ARTIFACT_NOT_FOUND"
            ? 404
            : 400;
        return Response.json(
          { error: err.message, code: err.code },
          { status },
        );
      }
      const rawMessage = err instanceof Error ? err.message : String(err);
      const message = redactSecrets(rawMessage);
      const code =
        err instanceof ProviderError || err instanceof RenderError
          ? err.code
          : "REVISION_FAILED";
      return Response.json({ error: message, code }, { status: 500 });
    }
  }

  // 2. GET /api/sessions/:id/candidates/:candidateId/versions
  const listVersionsMatch = pathname.match(
    /^\/api\/sessions\/([^/]+)\/candidates\/([^/]+)\/versions$/,
  );
  if (req.method === "GET" && listVersionsMatch) {
    const sessionId = decodeURIComponent(listVersionsMatch[1] ?? "");
    const candidateId = decodeURIComponent(listVersionsMatch[2] ?? "");

    try {
      const candidates = await sessionService.getCandidates(sessionId);
      const candidate = candidates.find((c) => c.id === candidateId);
      if (!candidate) {
        return Response.json(
          { error: `Candidate '${candidateId}' not found` },
          { status: 404 },
        );
      }

      return Response.json({
        versions: candidate.versions ?? [],
        currentVersionId: candidate.currentVersionId,
      });
    } catch (err: unknown) {
      if (err instanceof SessionError && err.code === "SESSION_NOT_FOUND") {
        return Response.json({ error: err.message }, { status: 404 });
      }
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ error: redactSecrets(message) }, { status: 500 });
    }
  }

  // 3. POST /api/sessions/:id/candidates/:candidateId/versions/:versionId/restore
  const restoreMatch = pathname.match(
    /^\/api\/sessions\/([^/]+)\/candidates\/([^/]+)\/versions\/([^/]+)\/restore$/,
  );
  if (req.method === "POST" && restoreMatch) {
    const sessionId = decodeURIComponent(restoreMatch[1] ?? "");
    const candidateId = decodeURIComponent(restoreMatch[2] ?? "");
    const versionId = decodeURIComponent(restoreMatch[3] ?? "");

    try {
      const result = await coordinator.restoreCandidateVersion(
        sessionId,
        candidateId,
        versionId,
      );
      return Response.json(result, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        const isNotFound = err.message.toLowerCase().includes("not found");
        return Response.json(
          { error: err.message, details: err.details },
          { status: isNotFound ? 404 : 400 },
        );
      }
      if (err instanceof SessionError && err.code === "SESSION_NOT_FOUND") {
        return Response.json({ error: err.message }, { status: 404 });
      }
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ error: redactSecrets(message) }, { status: 500 });
    }
  }

  return null;
}
