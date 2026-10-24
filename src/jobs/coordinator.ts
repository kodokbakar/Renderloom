import { EventEmitter } from "node:events";
import type { Candidate } from "../domain/candidate";
import { MAX_CANDIDATE_COUNT, MIN_CANDIDATE_COUNT } from "../domain/dimensions";
import { ValidationError } from "../domain/errors";
import type { BatchSummary } from "../domain/session";
import type { InMemoryKeyStore } from "../llm/keystore";
import type { ProviderRegistry } from "../llm/registry";
import { composePrompt } from "../prompts/composer";
import type { SessionService } from "../sessions/service";
import type { StyleRegistry } from "../styles/registry";
import { executeCandidateJob, formatCandidateId } from "./executor";
import { BoundedQueue } from "./queue";
import type {
  BatchStatus,
  BatchView,
  CandidateJobRecord,
  GenerationBatch,
  StartGenerationOptions,
} from "./types";

export interface CoordinatorDependencies {
  sessionService: SessionService;
  providerRegistry: ProviderRegistry;
  keyStore: InMemoryKeyStore;
  styleRegistry: StyleRegistry;
  concurrency?: number;
}

export class GenerationCoordinator extends EventEmitter {
  readonly sessionService: SessionService;
  readonly providerRegistry: ProviderRegistry;
  readonly keyStore: InMemoryKeyStore;
  readonly styleRegistry: StyleRegistry;
  readonly queue: BoundedQueue;

  private batches = new Map<string, GenerationBatch>();

  constructor(deps: CoordinatorDependencies) {
    super();
    this.sessionService = deps.sessionService;
    this.providerRegistry = deps.providerRegistry;
    this.keyStore = deps.keyStore;
    this.styleRegistry = deps.styleRegistry;
    this.queue = new BoundedQueue(deps.concurrency ?? 2);
  }

  getBatch(batchId: string): GenerationBatch | undefined {
    return this.batches.get(batchId);
  }

  getBatchView(batchId: string): BatchView | undefined {
    const batch = this.batches.get(batchId);
    if (!batch) return undefined;

    const candidates = batch.candidates.map((c) => c.candidate);
    const completed = candidates.filter((c) => c.state === "completed").length;
    const failed = candidates.filter((c) => c.state === "failed").length;
    const cancelled = candidates.filter((c) => c.state === "cancelled").length;

    return {
      id: batch.id,
      sessionId: batch.sessionId,
      status: batch.status,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      completedAt: batch.completedAt,
      candidates,
      summary: {
        total: candidates.length,
        completed,
        failed,
        cancelled,
      },
    };
  }

  async startGeneration(
    options: StartGenerationOptions,
  ): Promise<GenerationBatch> {
    const fullSession = await this.sessionService.getSession(options.sessionId);
    const session = fullSession.session;

    const candidateCount = options.candidateCount ?? 1;
    if (
      !Number.isInteger(candidateCount) ||
      candidateCount < MIN_CANDIDATE_COUNT ||
      candidateCount > MAX_CANDIDATE_COUNT
    ) {
      throw new ValidationError(
        `candidateCount must be an integer between ${MIN_CANDIDATE_COUNT} and ${MAX_CANDIDATE_COUNT}`,
      );
    }

    const providerId = options.providerId ?? session.providerId;
    const modelId = options.modelId ?? session.modelId;
    const styleId = options.styleId ?? session.styleId;
    const width = options.width ?? session.dimensions?.width ?? 1024;
    const height = options.height ?? session.dimensions?.height ?? 1024;

    const storedKey = this.keyStore.getKey(providerId);
    const apiKey = options.apiKey ?? storedKey?.apiKey;
    const baseUrl = options.baseUrl ?? storedKey?.baseUrl;
    if (!apiKey) {
      throw new ValidationError(`Missing API key for provider '${providerId}'`);
    }

    const providerAdapter = this.providerRegistry.get(providerId);
    if (!providerAdapter) {
      throw new ValidationError(`Unknown provider '${providerId}'`);
    }

    // Calculate starting candidate index based on existing candidates in session
    const existingCandidates = session.candidates ?? [];
    let highestIndex = 0;
    for (const c of existingCandidates) {
      if (typeof c.index === "number" && c.index > highestIndex) {
        highestIndex = c.index;
      }
    }

    const batchId = `batch-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const batchAbortController = new AbortController();

    const candidateRecords: CandidateJobRecord[] = [];
    for (let i = 0; i < candidateCount; i++) {
      const candidateIndex = highestIndex + i + 1;
      const candidateId = formatCandidateId(candidateIndex);
      const abortController = new AbortController();

      const candidate: Candidate = {
        id: candidateId,
        sessionId: session.id,
        index: candidateIndex,
        state: "queued",
        createdAt: now,
        updatedAt: now,
        timings: {
          queuedAt: now,
        },
      };

      candidateRecords.push({
        candidateId,
        index: candidateIndex,
        candidate,
        abortController,
      });
    }

    const { promise: completionPromise, resolve: resolveCompletion } =
      Promise.withResolvers<GenerationBatch>();

    const batch: GenerationBatch = {
      id: batchId,
      sessionId: session.id,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      options: {
        ...options,
        providerId,
        modelId,
        styleId,
        candidateCount,
        width,
        height,
      },
      candidates: candidateRecords,
      abortController: batchAbortController,
      completionPromise,
    };

    this.batches.set(batchId, batch);
    this.emit("batch_started", batch);

    for (const record of candidateRecords) {
      this.emit("candidate_queued", {
        batchId,
        candidate: record.candidate,
      });
      // Initial persistence of queued candidate
      await this.sessionService.saveCandidate(session.id, record.candidate);
    }

    // Compose prompt for candidates
    // ponytail: single composed prompt shared across candidate jobs in batch
    const composed = await composePrompt(
      {
        prompt: options.prompt,
        styleId,
        candidateCount: 1, // Compose request instructions per candidate
        width,
        height,
      },
      { styleRegistry: this.styleRegistry },
    );

    // Save prompt snapshot if session prompt snapshot not yet saved or updated
    try {
      await this.sessionService.savePromptSnapshot(
        session.id,
        composed.effectivePrompt,
      );
    } catch {
      // Non-critical
    }

    // Schedule candidate jobs in bounded queue
    batch.status = "running";
    batch.updatedAt = new Date().toISOString();

    const candidatePromises = candidateRecords.map((record) => {
      const effectiveSignal = AbortSignal.any([
        batch.abortController.signal,
        record.abortController.signal,
      ]);

      const jobPromise = this.queue
        .enqueue(async () => {
          const result = await executeCandidateJob({
            sessionId: session.id,
            candidateId: record.candidateId,
            index: record.index,
            prompt: composed.userPrompt,
            systemPrompt: composed.systemPrompt,
            providerAdapter,
            modelId,
            apiKey,
            baseUrl: options.baseUrl,
            width,
            height,
            sessionService: this.sessionService,
            maxRetries: options.maxRetries ?? 2,
            retryBaseDelayMs: options.retryBaseDelayMs ?? 500,
            signal: effectiveSignal,
            onUpdate: (updated) => {
              record.candidate = updated;
              this.emit("candidate_update", {
                batchId,
                candidate: updated,
              });
            },
          });

          record.candidate = result;
          if (result.state === "completed") {
            this.emit("candidate_completed", { batchId, candidate: result });
          } else if (result.state === "failed") {
            this.emit("candidate_failed", { batchId, candidate: result });
          } else if (result.state === "cancelled") {
            this.emit("candidate_cancelled", { batchId, candidate: result });
          }
          return result;
        }, record.candidateId)
        .catch(async () => {
          record.candidate.state = "cancelled";
          record.candidate.errorMessage = "Cancelled before execution";
          record.candidate.updatedAt = new Date().toISOString();
          this.emit("candidate_cancelled", {
            batchId,
            candidate: record.candidate,
          });
          try {
            await this.sessionService.saveCandidate(
              session.id,
              record.candidate,
            );
          } catch {
            // Non-critical
          }
          return record.candidate;
        });

      record.promise = jobPromise;
      return jobPromise;
    });

    // Handle batch completion asynchronously
    (async () => {
      await Promise.allSettled(candidatePromises);

      const completedCount = candidateRecords.filter(
        (c) => c.candidate.state === "completed",
      ).length;
      const failedCount = candidateRecords.filter(
        (c) => c.candidate.state === "failed",
      ).length;
      const cancelledCount = candidateRecords.filter(
        (c) => c.candidate.state === "cancelled",
      ).length;

      let finalStatus: BatchStatus = "completed";
      if (
        batch.abortController.signal.aborted ||
        batch.status === "cancelled"
      ) {
        finalStatus = completedCount > 0 ? "partial_success" : "cancelled";
      } else if (completedCount === candidateRecords.length) {
        finalStatus = "completed";
      } else if (completedCount > 0) {
        finalStatus = "partial_success";
      } else if (cancelledCount === candidateRecords.length) {
        finalStatus = "cancelled";
      } else if (failedCount === candidateRecords.length) {
        finalStatus = "failed";
      } else {
        finalStatus = "partial_success";
      }
      batch.status = finalStatus;
      batch.completedAt = new Date().toISOString();
      batch.updatedAt = batch.completedAt;

      const summary: BatchSummary = {
        batchId: batch.id,
        status: finalStatus,
        totalCandidates: candidateRecords.length,
        successfulCandidates: completedCount,
        failedCandidates: failedCount,
        cancelledCandidates: cancelledCount,
        completedAt: batch.completedAt,
      };

      try {
        await this.sessionService.recordBatchSummary(
          session.id,
          summary,
          candidateRecords.map((c) => c.candidate),
        );
      } catch {
        // Non-critical
      }

      this.emit("batch_completed", batch);
      resolveCompletion(batch);
    })();

    return batch;
  }

  cancelBatch(batchId: string): boolean {
    const batch = this.batches.get(batchId);
    if (!batch) return false;

    if (
      batch.status === "completed" ||
      batch.status === "failed" ||
      batch.status === "cancelled" ||
      batch.status === "partial_success"
    ) {
      return false;
    }

    batch.abortController.abort();
    for (const record of batch.candidates) {
      if (record.candidate.state === "queued") {
        this.queue.cancel(record.candidateId);
        record.candidate.state = "cancelled";
        record.candidate.errorMessage = "Cancelled before execution";
        record.candidate.updatedAt = new Date().toISOString();
        this.emit("candidate_cancelled", {
          batchId,
          candidate: record.candidate,
        });
        this.sessionService
          .saveCandidate(batch.sessionId, record.candidate)
          .catch(() => {});
      }
      record.abortController.abort();
    }
    batch.updatedAt = new Date().toISOString();
    return true;
  }

  cancelCandidate(batchId: string, candidateId: string): boolean {
    const batch = this.batches.get(batchId);
    if (!batch) return false;

    const record = batch.candidates.find((c) => c.candidateId === candidateId);
    if (!record) return false;
    if (
      record.candidate.state === "completed" ||
      record.candidate.state === "failed" ||
      record.candidate.state === "cancelled"
    ) {
      return false;
    }

    if (record.candidate.state === "queued") {
      this.queue.cancel(candidateId);
    }
    record.abortController.abort();
    return true;
  }

  async retryCandidate(
    batchId: string,
    candidateId: string,
  ): Promise<Candidate> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new ValidationError(`Batch '${batchId}' not found`);
    }

    const record = batch.candidates.find((c) => c.candidateId === candidateId);
    if (!record) {
      throw new ValidationError(
        `Candidate '${candidateId}' not found in batch '${batchId}'`,
      );
    }

    if (record.candidate.state === "completed") {
      throw new ValidationError(
        `Candidate '${candidateId}' is already completed and cannot be retried`,
      );
    }

    const fullSession = await this.sessionService.getSession(batch.sessionId);
    const session = fullSession.session;

    const providerId = batch.options.providerId ?? session.providerId;
    const modelId = batch.options.modelId ?? session.modelId;
    const styleId = batch.options.styleId ?? session.styleId;
    const width = batch.options.width ?? session.dimensions?.width ?? 1024;
    const height = batch.options.height ?? session.dimensions?.height ?? 1024;

    const storedKey = this.keyStore.getKey(providerId);
    const apiKey = batch.options.apiKey ?? storedKey?.apiKey;
    const baseUrl = batch.options.baseUrl ?? storedKey?.baseUrl;
    if (!apiKey) {
      throw new ValidationError(`Missing API key for provider '${providerId}'`);
    }

    const providerAdapter = this.providerRegistry.get(providerId);
    if (!providerAdapter) {
      throw new ValidationError(`Unknown provider '${providerId}'`);
    }

    // Reset candidate record state
    const newAbortController = new AbortController();
    record.abortController = newAbortController;
    record.candidate.state = "queued";
    record.candidate.errorMessage = undefined;
    record.candidate.errorCode = undefined;
    record.candidate.retries = 0;
    record.candidate.updatedAt = new Date().toISOString();

    this.emit("candidate_update", { batchId, candidate: record.candidate });
    await this.sessionService.saveCandidate(session.id, record.candidate);

    const composed = await composePrompt(
      {
        prompt: batch.options.prompt,
        styleId,
        candidateCount: 1,
        width,
        height,
      },
      { styleRegistry: this.styleRegistry },
    );

    const effectiveSignal = AbortSignal.any([
      batch.abortController.signal,
      newAbortController.signal,
    ]);

    const jobPromise = this.queue.enqueue(async () => {
      const result = await executeCandidateJob({
        sessionId: session.id,
        candidateId: record.candidateId,
        index: record.index,
        prompt: composed.userPrompt,
        systemPrompt: composed.systemPrompt,
        providerAdapter,
        modelId,
        apiKey,
        baseUrl: batch.options.baseUrl,
        width,
        height,
        sessionService: this.sessionService,
        maxRetries: batch.options.maxRetries ?? 2,
        retryBaseDelayMs: batch.options.retryBaseDelayMs ?? 500,
        signal: effectiveSignal,
        onUpdate: (updated) => {
          record.candidate = updated;
          this.emit("candidate_update", {
            batchId,
            candidate: updated,
          });
        },
      });

      record.candidate = result;
      if (result.state === "completed") {
        this.emit("candidate_completed", { batchId, candidate: result });
      } else if (result.state === "failed") {
        this.emit("candidate_failed", { batchId, candidate: result });
      } else if (result.state === "cancelled") {
        this.emit("candidate_cancelled", { batchId, candidate: result });
      }

      // Recompute batch status
      const completedCount = batch.candidates.filter(
        (c) => c.candidate.state === "completed",
      ).length;
      const failedCount = batch.candidates.filter(
        (c) => c.candidate.state === "failed",
      ).length;
      const cancelledCount = batch.candidates.filter(
        (c) => c.candidate.state === "cancelled",
      ).length;

      let newStatus: BatchStatus = "completed";
      if (completedCount === batch.candidates.length) {
        newStatus = "completed";
      } else if (completedCount > 0) {
        newStatus = "partial_success";
      } else if (cancelledCount === batch.candidates.length) {
        newStatus = "cancelled";
      } else if (failedCount === batch.candidates.length) {
        newStatus = "failed";
      } else {
        newStatus = "partial_success";
      }

      batch.status = newStatus;
      batch.updatedAt = new Date().toISOString();

      const summary: BatchSummary = {
        batchId: batch.id,
        status: newStatus,
        totalCandidates: batch.candidates.length,
        successfulCandidates: completedCount,
        failedCandidates: failedCount,
        cancelledCandidates: cancelledCount,
        completedAt: batch.updatedAt,
      };

      try {
        await this.sessionService.recordBatchSummary(
          session.id,
          summary,
          batch.candidates.map((c) => c.candidate),
        );
      } catch {
        // Non-critical
      }

      return result;
    }, record.candidateId);

    record.promise = jobPromise;
    return jobPromise;
  }
}
