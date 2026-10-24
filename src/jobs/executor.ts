import type {
  Candidate,
  CandidateState,
  CandidateTiming,
} from "../domain/candidate";
import { ProviderError, RenderError, ValidationError } from "../domain/errors";
import type { ProviderAdapter } from "../domain/provider";
import { render } from "../renderer/render";
import { validateJsx } from "../renderer/validator";
import { redactSecrets } from "../security/redact";
import type { SessionService } from "../sessions/service";
import { normalizeCandidateResponse } from "./parser";
import { calculateBackoff, isRetryableError, sleepWithAbort } from "./retry";

export interface CandidateJobOptions {
  sessionId: string;
  candidateId: string;
  index: number;
  versionId?: string;
  prompt: string;
  systemPrompt?: string;
  providerAdapter: ProviderAdapter;
  modelId: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  width: number;
  height: number;
  sessionService: SessionService;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  signal?: AbortSignal;
  onUpdate?: (candidate: Candidate) => void;
}

export function formatCandidateId(index: number): string {
  return `design-${String(index).padStart(3, "0")}`;
}

export async function executeCandidateJob(
  options: CandidateJobOptions,
): Promise<Candidate> {
  const {
    sessionId,
    candidateId,
    index,
    versionId = "v001",
    prompt,
    systemPrompt,
    providerAdapter,
    modelId,
    apiKey,
    baseUrl,
    temperature,
    width,
    height,
    sessionService,
    maxRetries = 2,
    retryBaseDelayMs = 500,
    signal,
    onUpdate,
  } = options;

  const now = new Date().toISOString();
  const timings: CandidateTiming = {
    queuedAt: now,
  };

  const candidate: Candidate = {
    id: candidateId,
    sessionId,
    index,
    state: "queued",
    retries: 0,
    timings,
    createdAt: now,
    updatedAt: now,
  };

  const updateState = async (
    newState: CandidateState,
    errorMessage?: string,
    errorCode?: string,
  ) => {
    candidate.state = newState;
    candidate.updatedAt = new Date().toISOString();
    if (errorMessage !== undefined) {
      candidate.errorMessage = redactSecrets(errorMessage);
    }
    if (errorCode !== undefined) {
      candidate.errorCode = errorCode;
    }
    onUpdate?.(candidate);
    try {
      await sessionService.saveCandidate(sessionId, candidate);
    } catch {
      // Ignore intermediate persistence error
    }
  };

  // Immediate check for abort
  if (signal?.aborted) {
    await updateState("cancelled", "Cancelled by caller");
    return candidate;
  }

  // 1. Generation stage
  timings.generationStartedAt = new Date().toISOString();
  await updateState("generating");

  let rawText = "";
  let attempt = 0;

  while (true) {
    if (signal?.aborted) {
      await updateState("cancelled", "Cancelled by caller");
      return candidate;
    }

    try {
      const response = await providerAdapter.generate({
        prompt,
        systemPrompt,
        modelId,
        apiKey,
        baseUrl,
        temperature,
        signal,
      });
      rawText = response.rawText;
      timings.generationEndedAt = new Date().toISOString();
      break;
    } catch (err: unknown) {
      if (
        signal?.aborted ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        await updateState("cancelled", "Cancelled by caller");
        return candidate;
      }

      if (isRetryableError(err) && attempt < maxRetries) {
        attempt++;
        candidate.retries = attempt;
        const delay = calculateBackoff(attempt, retryBaseDelayMs);
        try {
          await sleepWithAbort(delay, signal);
        } catch {
          await updateState("cancelled", "Cancelled by caller");
          return candidate;
        }
        continue;
      }

      // Permanent or exhausted retry error
      const message = err instanceof Error ? err.message : String(err);
      let code = "GENERATION_FAILED";
      if (err instanceof ProviderError) {
        code = err.code;
      }
      await updateState("failed", message, code);
      return candidate;
    }
  }

  // 2. Validation stage
  timings.validationStartedAt = new Date().toISOString();
  await updateState("validating");

  if (signal?.aborted) {
    await updateState("cancelled", "Cancelled by caller");
    return candidate;
  }

  let jsx = "";
  try {
    const contract = normalizeCandidateResponse(rawText, {
      expectedIndex: index,
    });
    candidate.label = contract.label;
    candidate.rationale = contract.rationale;
    jsx = contract.jsx;

    // Validate JSX syntax and allowlist
    validateJsx(jsx);
    timings.validationEndedAt = new Date().toISOString();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const code =
      err instanceof ValidationError
        ? err.code
        : err instanceof RenderError
          ? err.code
          : "VALIDATION_ERROR";
    await updateState("failed", message, code);
    return candidate;
  }

  // 3. Rendering stage
  timings.renderingStartedAt = new Date().toISOString();
  await updateState("rendering");

  if (signal?.aborted) {
    await updateState("cancelled", "Cancelled by caller");
    return candidate;
  }

  let svgContent = "";
  let pngBuffer: Buffer | Uint8Array;

  try {
    const renderResult = await render(jsx, { width, height });
    svgContent = renderResult.svg;
    pngBuffer = renderResult.png;
    timings.renderingEndedAt = new Date().toISOString();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof RenderError ? err.code : "RENDER_FAILED";
    await updateState("failed", message, code);
    return candidate;
  }

  // 4. Persistence & Completion
  try {
    const jsxFilename = `${candidateId}-${versionId}.jsx`;
    const svgFilename = `${candidateId}-${versionId}.svg`;
    const pngFilename = `${candidateId}-${versionId}.png`;

    await sessionService.saveArtifact(sessionId, "source", jsxFilename, jsx);
    await sessionService.saveArtifact(
      sessionId,
      "svg",
      svgFilename,
      svgContent,
    );
    await sessionService.saveArtifact(
      sessionId,
      "images",
      pngFilename,
      pngBuffer,
    );

    candidate.currentVersionId = versionId;
    candidate.artifacts = {
      sourcePath: `source/${jsxFilename}`,
      svgPath: `svg/${svgFilename}`,
      pngPath: `images/${pngFilename}`,
    };
    timings.completedAt = new Date().toISOString();
    if (timings.queuedAt) {
      timings.durationMs =
        new Date(timings.completedAt).getTime() -
        new Date(timings.queuedAt).getTime();
    }

    await updateState("completed");
    return candidate;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await updateState(
      "failed",
      `Artifact persistence failed: ${message}`,
      "PERSISTENCE_ERROR",
    );
    return candidate;
  }
}
