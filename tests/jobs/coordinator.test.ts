import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { Candidate } from "../../src/domain/candidate";
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
});
