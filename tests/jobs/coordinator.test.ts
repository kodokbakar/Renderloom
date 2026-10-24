import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { Candidate } from "../../src/domain/candidate";
import { ValidationError } from "../../src/domain/errors";
import type {
  LLMGenerationRequest,
  LLMGenerationResponse,
  ProviderAdapter,
  ProviderMeta,
} from "../../src/domain/provider";
import { GenerationCoordinator } from "../../src/jobs/coordinator";
import { InMemoryKeyStore } from "../../src/llm/keystore";
import { ProviderRegistry } from "../../src/llm/registry";
import { SessionService } from "../../src/sessions/service";
import { StyleRegistry } from "../../src/styles/registry";

const TEST_DIR = path.join(process.cwd(), `tmp-test-coordinator-${Date.now()}`);

class MockAdapter implements ProviderAdapter {
  readonly id = "mock";
  readonly meta: ProviderMeta = {
    id: "mock",
    name: "Mock",
    supportsCustomBaseUrl: false,
    defaultModelId: "mock-model",
    models: [{ id: "mock-model", name: "Mock Model" }],
  };

  generateFn: (req: LLMGenerationRequest) => Promise<LLMGenerationResponse>;

  constructor(
    generateFn: (req: LLMGenerationRequest) => Promise<LLMGenerationResponse>,
  ) {
    this.generateFn = generateFn;
  }

  async testConnection() {
    return { success: true, latencyMs: 1, modelId: "mock-model" };
  }

  async generate(req: LLMGenerationRequest): Promise<LLMGenerationResponse> {
    return this.generateFn(req);
  }
}

describe("GenerationCoordinator", () => {
  let sessionService: SessionService;
  let keyStore: InMemoryKeyStore;
  let providerRegistry: ProviderRegistry;
  let styleRegistry: StyleRegistry;
  let sessionId: string;

  beforeEach(async () => {
    sessionService = new SessionService(TEST_DIR);
    keyStore = new InMemoryKeyStore();
    await keyStore.setKey("mock", "mock-key");

    providerRegistry = new ProviderRegistry();
    styleRegistry = new StyleRegistry();

    const session = await sessionService.createSession({
      name: "Coordinator Test",
      providerId: "mock",
      modelId: "mock-model",
      styleId: "minimal",
      width: 200,
      height: 100,
    });
    sessionId = session.id;
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  test("generates multiple candidates with stable IDs and bounded concurrency", async () => {
    let callIndex = 0;
    const adapter = new MockAdapter(async (req) => {
      callIndex++;
      const idx = callIndex;
      return {
        rawText: JSON.stringify({
          label: `Design ${idx}`,
          rationale: `Rationale for design ${idx}`,
          jsx: `<div style={{ width: 200, height: 100, color: '#fff' }}>Design ${idx}</div>`,
        }),
        modelId: "mock-model",
        durationMs: 20,
      };
    });
    providerRegistry.register(adapter);

    const coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
      concurrency: 2,
    });

    const events: string[] = [];
    coordinator.on("batch_started", () => events.push("batch_started"));
    coordinator.on("candidate_completed", (e) =>
      events.push(`completed:${e.candidate.id}`),
    );
    coordinator.on("batch_completed", () => events.push("batch_completed"));

    const batch = await coordinator.startGeneration({
      sessionId,
      prompt: "Two variants of hero card",
      candidateCount: 2,
    });

    expect(batch.candidates.length).toBe(2);
    const [cand0, cand1] = batch.candidates;
    expect(cand0?.candidateId).toBe("design-001");
    expect(cand1?.candidateId).toBe("design-002");

    const completedBatch = await batch.completionPromise;

    expect(completedBatch.status).toBe("completed");
    const [done0, done1] = completedBatch.candidates;
    expect(done0?.candidate.state).toBe("completed");
    expect(done1?.candidate.state).toBe("completed");

    expect(events).toContain("batch_started");
    expect(events).toContain("completed:design-001");
    expect(events).toContain("completed:design-002");
    expect(events).toContain("batch_completed");

    // Check disk artifacts
    const full = await sessionService.getSession(sessionId);
    expect(full.session.candidates?.length).toBe(2);
    expect(full.artifacts.images).toContain("design-001-v001.png");
    expect(full.artifacts.images).toContain("design-002-v001.png");
  });

  test("handles partial success when one candidate fails", async () => {
    let callCount = 0;
    const adapter = new MockAdapter(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          rawText: JSON.stringify({
            label: "Good Design",
            rationale: "Rationale",
            jsx: "<div style={{ width: 200, height: 100 }}>Good</div>",
          }),
          modelId: "mock-model",
          durationMs: 10,
        };
      }
      // Candidate 2 returns malformed output
      return {
        rawText: "not a json string at all",
        modelId: "mock-model",
        durationMs: 10,
      };
    });
    providerRegistry.register(adapter);

    const coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });

    const batch = await coordinator.startGeneration({
      sessionId,
      prompt: "Test partial failure",
      candidateCount: 2,
    });

    const finished = await batch.completionPromise;

    expect(finished.status).toBe("partial_success");
    const [fin0, fin1] = finished.candidates;
    expect(fin0?.candidate.state).toBe("completed");
    expect(fin1?.candidate.state).toBe("failed");

    // Successful candidate is intact and downloadable
    const full = await sessionService.getSession(sessionId);
    expect(full.session.lastBatchStatus).toBe("partial_success");
    expect(full.artifacts.images).toContain("design-001-v001.png");
    expect(
      full.session.candidates?.find((c) => c.id === "design-001")?.state,
    ).toBe("completed");
    expect(
      full.session.candidates?.find((c) => c.id === "design-002")?.state,
    ).toBe("failed");
  });

  test("retrying a failed candidate succeeds without overwriting completed candidate", async () => {
    let callCount = 0;
    const adapter = new MockAdapter(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          rawText: JSON.stringify({
            label: "Candidate 1",
            rationale: "Rationale 1",
            jsx: "<div style={{ width: 200, height: 100 }}>Design 1</div>",
          }),
          modelId: "mock-model",
          durationMs: 10,
        };
      }
      if (callCount === 2) {
        // Fail on initial attempt
        return {
          rawText: "bad",
          modelId: "mock-model",
          durationMs: 10,
        };
      }
      // Succeed on retry
      return {
        rawText: JSON.stringify({
          label: "Candidate 2 Retried",
          rationale: "Now works",
          jsx: "<div style={{ width: 200, height: 100 }}>Design 2 Fixed</div>",
        }),
        modelId: "mock-model",
        durationMs: 10,
      };
    });
    providerRegistry.register(adapter);

    const coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });

    const batch = await coordinator.startGeneration({
      sessionId,
      prompt: "Retry test",
      candidateCount: 2,
    });

    await batch.completionPromise;
    expect(batch.status).toBe("partial_success");
    const [retry0, retry1] = batch.candidates;
    expect(retry1?.candidate.state).toBe("failed");

    // Retry candidate 2
    const retriedCandidate = await coordinator.retryCandidate(
      batch.id,
      "design-002",
    );
    expect(retriedCandidate.state).toBe("completed");
    expect(retriedCandidate.label).toBe("Candidate 2 Retried");

    // Candidate 1 was not modified
    expect(retry0?.candidate.state).toBe("completed");
    expect(retry0?.candidate.label).toBe("Candidate 1");

    // Batch status is now completed
    expect(batch.status).toBe("completed");

    // Disk artifacts now contain both
    const full = await sessionService.getSession(sessionId);
    expect(full.artifacts.images).toContain("design-001-v001.png");
    expect(full.artifacts.images).toContain("design-002-v001.png");
    expect(full.session.candidates?.length).toBe(2);
    expect(
      full.session.candidates?.find((c) => c.id === "design-002")?.label,
    ).toBe("Candidate 2 Retried");
  });

  test("cancelling a batch aborts pending and running jobs", async () => {
    const gate = Promise.withResolvers<void>();
    const adapter = new MockAdapter(async (req) => {
      const { promise, reject } =
        Promise.withResolvers<LLMGenerationResponse>();
      req.signal?.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
      return promise;
    });
    providerRegistry.register(adapter);

    const coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
      concurrency: 1,
    });

    const batch = await coordinator.startGeneration({
      sessionId,
      prompt: "Cancel test",
      candidateCount: 2,
    });

    const cancelled = coordinator.cancelBatch(batch.id);
    expect(cancelled).toBe(true);

    const finished = await batch.completionPromise;
    expect(finished.status).toBe("cancelled");
    expect(
      finished.candidates.every((c) => c.candidate.state === "cancelled"),
    ).toBe(true);
  });

  test("increments candidate IDs stably across successive generation batches in the same session", async () => {
    const adapter = new MockAdapter(async () => ({
      rawText: JSON.stringify({
        label: "Design",
        rationale: "Rationale",
        jsx: "<div style={{ width: 200, height: 100 }}>Design</div>",
      }),
      modelId: "mock-model",
      durationMs: 5,
    }));
    providerRegistry.register(adapter);

    const coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });

    // Batch 1: candidate count 2
    const b1 = await coordinator.startGeneration({
      sessionId,
      prompt: "First batch",
      candidateCount: 2,
    });
    await b1.completionPromise;
    expect(b1.candidates.map((c) => c.candidateId)).toEqual([
      "design-001",
      "design-002",
    ]);

    // Batch 2: candidate count 2
    const b2 = await coordinator.startGeneration({
      sessionId,
      prompt: "Second batch",
      candidateCount: 2,
    });
    await b2.completionPromise;
    expect(b2.candidates.map((c) => c.candidateId)).toEqual([
      "design-003",
      "design-004",
    ]);

    const full = await sessionService.getSession(sessionId);
    const ids = full.session.candidates?.map((c) => c.id);
    expect(ids).toEqual([
      "design-001",
      "design-002",
      "design-003",
      "design-004",
    ]);

    // Batch 3: candidate count 1 to verify continued monotonicity
    const b3 = await coordinator.startGeneration({
      sessionId,
      prompt: "Third batch",
      candidateCount: 1,
    });
    await b3.completionPromise;
    expect(b3.candidates.map((c) => c.candidateId)).toEqual(["design-005"]);

    const fullAfterB3 = await sessionService.getSession(sessionId);
    const allIds = fullAfterB3.session.candidates?.map((c) => c.id);
    expect(allIds).toEqual([
      "design-001",
      "design-002",
      "design-003",
      "design-004",
      "design-005",
    ]);
  });

  test("rejects retrying an already completed candidate with ValidationError", async () => {
    const adapter = new MockAdapter(async () => ({
      rawText: JSON.stringify({
        label: "Success",
        rationale: "Works",
        jsx: "<div style={{ width: 200, height: 100 }}>OK</div>",
      }),
      modelId: "mock-model",
      durationMs: 5,
    }));
    providerRegistry.register(adapter);

    const coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });

    const batch = await coordinator.startGeneration({
      sessionId,
      prompt: "Single",
      candidateCount: 1,
    });
    await batch.completionPromise;

    await expect(
      coordinator.retryCandidate(batch.id, "design-001"),
    ).rejects.toThrow(ValidationError);
    await expect(
      coordinator.retryCandidate(batch.id, "design-001"),
    ).rejects.toThrow(/already completed/);

    await expect(
      coordinator.retryCandidate(batch.id, "nonexistent"),
    ).rejects.toThrow(ValidationError);
  });

  test("cancelling individual queued candidate leaves running candidate to finish as partial_success", async () => {
    const gate = Promise.withResolvers<void>();
    let callCount = 0;

    const adapter = new MockAdapter(async () => {
      callCount++;
      if (callCount === 1) {
        await gate.promise;
      }
      return {
        rawText: JSON.stringify({
          label: "Card",
          rationale: "Rationale",
          jsx: "<div style={{ width: 200, height: 100 }}>Content</div>",
        }),
        modelId: "mock-model",
        durationMs: 5,
      };
    });
    providerRegistry.register(adapter);

    const coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
      concurrency: 1,
    });

    const batch = await coordinator.startGeneration({
      sessionId,
      prompt: "Two candidates concurrency 1",
      candidateCount: 2,
    });

    // Cancel candidate 2 while candidate 1 is running
    const didCancel = coordinator.cancelCandidate(batch.id, "design-002");
    expect(didCancel).toBe(true);

    // Release candidate 1
    gate.resolve();
    const finished = await batch.completionPromise;

    expect(finished.status).toBe("partial_success");
    expect(finished.candidates[0]?.candidate.state).toBe("completed");
    expect(finished.candidates[1]?.candidate.state).toBe("cancelled");

    // Guard on partial_success batch and terminal candidate states
    expect(coordinator.cancelBatch(batch.id)).toBe(false);
    expect(coordinator.cancelCandidate(batch.id, "design-001")).toBe(false);
    expect(coordinator.cancelCandidate(batch.id, "design-002")).toBe(false);
  });

  test("rapid multiple cancellations on batch and candidate are idempotent", async () => {
    const adapter = new MockAdapter(async (req) => {
      const { promise, reject } =
        Promise.withResolvers<LLMGenerationResponse>();
      req.signal?.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
      return promise;
    });
    providerRegistry.register(adapter);

    const coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });

    const batch = await coordinator.startGeneration({
      sessionId,
      prompt: "Rapid cancel",
      candidateCount: 2,
    });

    // Call cancelCandidate multiple times rapidly
    const c1 = coordinator.cancelCandidate(batch.id, "design-001");
    const c2 = coordinator.cancelCandidate(batch.id, "design-001");
    expect(c1).toBe(true);
    expect(c2).toBe(true);

    // Call cancelBatch multiple times
    const b1 = coordinator.cancelBatch(batch.id);
    const b2 = coordinator.cancelBatch(batch.id);
    expect(b1).toBe(true);
    expect(b2).toBe(true);

    const finished = await batch.completionPromise;
    expect(finished.status).toBe("cancelled");

    // After completion, cancelBatch returns false
    expect(coordinator.cancelBatch(batch.id)).toBe(false);
    expect(coordinator.cancelBatch("nonexistent")).toBe(false);
    expect(coordinator.cancelCandidate("nonexistent", "design-001")).toBe(
      false,
    );
    expect(coordinator.cancelCandidate(batch.id, "design-001")).toBe(false);
    expect(coordinator.cancelCandidate(batch.id, "design-002")).toBe(false);
  });

  test("distinguishes total failure from partial success when all candidates fail", async () => {
    const adapter = new MockAdapter(async () => ({
      rawText: "not json",
      modelId: "mock-model",
      durationMs: 5,
    }));
    providerRegistry.register(adapter);

    const coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });

    const batch = await coordinator.startGeneration({
      sessionId,
      prompt: "All fail",
      candidateCount: 2,
    });
    const finished = await batch.completionPromise;

    expect(finished.status).toBe("failed");
    expect(
      finished.candidates.every((c) => c.candidate.state === "failed"),
    ).toBe(true);

    const view = coordinator.getBatchView(batch.id);
    expect(view?.status).toBe("failed");
    expect(view?.summary).toEqual({
      total: 2,
      completed: 0,
      failed: 2,
      cancelled: 0,
    });
    expect(coordinator.cancelBatch(batch.id)).toBe(false);
    expect(coordinator.cancelCandidate(batch.id, "design-001")).toBe(false);
  });
  test("allows custom provider execution without apiKey", async () => {
    let capturedReq: LLMGenerationRequest | undefined;
    class CustomMockAdapter implements ProviderAdapter {
      readonly id = "custom";
      readonly meta: ProviderMeta = {
        id: "custom",
        name: "Custom",
        supportsCustomBaseUrl: true,
        defaultModelId: "llama3",
        models: [{ id: "llama3", name: "Llama 3" }],
      };
      async testConnection() {
        return { success: true, latencyMs: 1, modelId: "llama3" };
      }
      async generate(req: LLMGenerationRequest) {
        capturedReq = req;
        return {
          rawText: JSON.stringify({
            label: "Custom Design",
            rationale: "Testing custom provider",
            jsx: `<div style={{ width: 200, height: 100, color: '#fff' }}>Custom Design</div>`,
          }),
          modelId: "llama3",
          durationMs: 5,
        };
      }
    }

    const customSession = await sessionService.createSession({
      name: "Custom Session",
      providerId: "custom",
      modelId: "llama3",
      styleId: "minimal",
      width: 200,
      height: 100,
    });

    providerRegistry.register(new CustomMockAdapter());
    const coordinator = new GenerationCoordinator({
      sessionService,
      keyStore,
      providerRegistry,
      styleRegistry,
    });

    const batch = await coordinator.startGeneration({
      sessionId: customSession.id,
      prompt: "Test custom prompt",
      candidateCount: 1,
    });

    const finished = await batch.completionPromise;
    expect(finished.status).toBe("completed");
    expect(capturedReq?.apiKey).toBe("");
  });
});
