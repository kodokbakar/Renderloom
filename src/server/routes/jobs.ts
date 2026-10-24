import { SessionError, ValidationError } from "../../domain/errors";
import type { GenerationCoordinator } from "../../jobs/coordinator";
import type { StartGenerationOptions } from "../../jobs/types";
import type { SessionService } from "../../sessions/service";

export async function handleJobRoute(
  req: Request,
  url: URL,
  coordinator: GenerationCoordinator,
  sessionService: SessionService,
): Promise<Response | null> {
  const pathname = url.pathname;

  try {
    // 1. POST /api/generations
    if (req.method === "POST" && pathname === "/api/generations") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return Response.json(
          { error: "Invalid JSON in request body" },
          { status: 400 },
        );
      }

      if (!body || typeof body !== "object") {
        return Response.json(
          { error: "Request body must be an object" },
          { status: 400 },
        );
      }

      const { sessionId, prompt } = body as Record<string, unknown>;
      if (!sessionId || typeof sessionId !== "string") {
        return Response.json(
          { error: "sessionId is required" },
          { status: 400 },
        );
      }
      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return Response.json({ error: "prompt is required" }, { status: 400 });
      }

      const batch = await coordinator.startGeneration(
        body as unknown as StartGenerationOptions,
      );
      return Response.json(
        {
          batchId: batch.id,
          sessionId: batch.sessionId,
          status: batch.status,
          candidates: batch.candidates.map((c) => c.candidate),
        },
        { status: 202 },
      );
    }

    // 2. GET /api/generations/:batchId/events (SSE)
    const sseMatch = pathname.match(/^\/api\/generations\/([^/]+)\/events$/);
    if (req.method === "GET" && sseMatch) {
      const batchId = decodeURIComponent(sseMatch[1] ?? "");
      const batch = coordinator.getBatch(batchId);
      if (!batch) {
        return Response.json({ error: "Batch not found" }, { status: 404 });
      }

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const send = (event: string, data: unknown) => {
            try {
              controller.enqueue(
                encoder.encode(
                  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
                ),
              );
            } catch {
              // Stream closed
            }
          };

          send("snapshot", coordinator.getBatchView(batchId));

          const isTerminal =
            batch.status === "completed" ||
            batch.status === "partial_success" ||
            batch.status === "failed" ||
            batch.status === "cancelled";

          if (isTerminal) {
            controller.close();
            return;
          }

          const onUpdate = (evt: { batchId: string; candidate: unknown }) => {
            if (evt.batchId === batchId) {
              send("candidate_update", evt.candidate);
            }
          };

          const onBatchDone = (completedBatch: { id: string }) => {
            if (completedBatch.id === batchId) {
              send("batch_completed", coordinator.getBatchView(batchId));
              cleanup();
              try {
                controller.close();
              } catch {}
            }
          };

          const cleanup = () => {
            coordinator.off("candidate_update", onUpdate);
            coordinator.off("batch_completed", onBatchDone);
          };

          coordinator.on("candidate_update", onUpdate);
          coordinator.on("batch_completed", onBatchDone);

          req.signal.addEventListener("abort", () => {
            cleanup();
            try {
              controller.close();
            } catch {}
          });
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // 3. POST /api/generations/:batchId/candidates/:candidateId/cancel
    const candidateCancelMatch = pathname.match(
      /^\/api\/generations\/([^/]+)\/candidates\/([^/]+)\/cancel$/,
    );
    if (req.method === "POST" && candidateCancelMatch) {
      const batchId = decodeURIComponent(candidateCancelMatch[1] ?? "");
      const candidateId = decodeURIComponent(candidateCancelMatch[2] ?? "");
      const ok = coordinator.cancelCandidate(batchId, candidateId);
      if (!ok) {
        return Response.json(
          {
            error: `Candidate '${candidateId}' or batch '${batchId}' not found`,
          },
          { status: 404 },
        );
      }
      return Response.json({ cancelled: true, candidateId });
    }

    // 4. POST /api/generations/:batchId/candidates/:candidateId/retry
    const candidateRetryMatch = pathname.match(
      /^\/api\/generations\/([^/]+)\/candidates\/([^/]+)\/retry$/,
    );
    if (req.method === "POST" && candidateRetryMatch) {
      const batchId = decodeURIComponent(candidateRetryMatch[1] ?? "");
      const candidateId = decodeURIComponent(candidateRetryMatch[2] ?? "");
      const candidate = await coordinator.retryCandidate(batchId, candidateId);
      return Response.json({ candidate });
    }

    // 5. POST /api/generations/:batchId/cancel
    const batchCancelMatch = pathname.match(
      /^\/api\/generations\/([^/]+)\/cancel$/,
    );
    if (req.method === "POST" && batchCancelMatch) {
      const batchId = decodeURIComponent(batchCancelMatch[1] ?? "");
      const ok = coordinator.cancelBatch(batchId);
      if (!ok) {
        return Response.json(
          { error: `Batch '${batchId}' not found or cannot be cancelled` },
          { status: 404 },
        );
      }
      return Response.json({ cancelled: true, batchId });
    }

    // 6. GET /api/generations/:batchId
    const batchMatch = pathname.match(/^\/api\/generations\/([^/]+)$/);
    if (req.method === "GET" && batchMatch) {
      const batchId = decodeURIComponent(batchMatch[1] ?? "");
      const view = coordinator.getBatchView(batchId);
      if (!view) {
        return Response.json({ error: "Batch not found" }, { status: 404 });
      }
      return Response.json({ batch: view });
    }

    // 7. GET /api/sessions/:id/candidates
    const sessionCandidatesMatch = pathname.match(
      /^\/api\/sessions\/([^/]+)\/candidates$/,
    );
    if (req.method === "GET" && sessionCandidatesMatch) {
      const id = decodeURIComponent(sessionCandidatesMatch[1] ?? "");
      const candidates = await sessionService.getCandidates(id);
      return Response.json({ candidates });
    }

    return null;
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      return Response.json(
        { error: err.message, details: err.details },
        { status: 400 },
      );
    }
    if (err instanceof SessionError) {
      const status = err.code === "SESSION_NOT_FOUND" ? 404 : 400;
      return Response.json({ error: err.message, code: err.code }, { status });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
