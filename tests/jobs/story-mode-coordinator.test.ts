import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
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

const TEST_DIR = path.join(
  process.cwd(),
  `tmp-test-story-coord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
);

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

describe("GenerationCoordinator Story Mode Integration", () => {
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
      name: "Story Mode Coordinator Test",
      providerId: "mock",
      modelId: "mock-model",
      styleId: "minimal",
      width: 200,
      height: 100,
    });
    sessionId = session.id;
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  });

  test("startGeneration in Story Mode executes per-slide prompts with Hook -> Core -> Payoff", async () => {
    const receivedPrompts: { prompt: string; systemPrompt: string }[] = [];

    const adapter = new MockAdapter(async (req) => {
      receivedPrompts.push({
        prompt: req.prompt,
        systemPrompt: req.systemPrompt ?? "",
      });

      return {
        rawText: JSON.stringify({
          candidates: [
            {
              candidateIndex: 1,
              label: "Story Slide",
              rationale: "Fulfills narrative step",
              jsx: "<div style={{ width: 200, height: 100, backgroundColor: '#ffffff' }}><span>Slide</span></div>",
            },
          ],
        }),
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        durationMs: 10,
        modelId: "mock-model",
      };
    });
    providerRegistry.register(adapter);

    const coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
      concurrency: 3,
    });

    const batch = await coordinator.startGeneration({
      sessionId,
      prompt: "Chronicle the evolution of typography",
      candidateCount: 3,
      storyMode: true,
    });

    await batch.completionPromise;

    expect(batch.status).toBe("completed");
    expect(batch.options.storyMode).toBe(true);
    expect(batch.candidates.length).toBe(3);

    // Verify candidate storyArcRoles
    expect(batch.candidates[0]?.candidate.storyArcRole).toBe("hook");
    expect(batch.candidates[1]?.candidate.storyArcRole).toBe("core");
    expect(batch.candidates[2]?.candidate.storyArcRole).toBe("payoff");

    // Verify per-slide prompts sent to provider
    expect(receivedPrompts.length).toBe(3);

    // Slide 1 should contain Hook instructions
    const hookReq = receivedPrompts.find((p) => p.prompt.includes("Slide 1/3"));
    expect(hookReq).toBeDefined();
    expect(hookReq?.systemPrompt).toContain("HOOK");
    expect(hookReq?.prompt).toContain("Hook (hook)");

    // Slide 2 should contain Core instructions
    const coreReq = receivedPrompts.find((p) => p.prompt.includes("Slide 2/3"));
    expect(coreReq).toBeDefined();
    expect(coreReq?.systemPrompt).toContain("CORE");
    expect(coreReq?.prompt).toContain("Core (core)");

    // Slide 3 should contain Payoff instructions
    const payoffReq = receivedPrompts.find((p) =>
      p.prompt.includes("Slide 3/3"),
    );
    expect(payoffReq).toBeDefined();
    expect(payoffReq?.systemPrompt).toContain("PAYOFF");
    expect(payoffReq?.prompt).toContain("Payoff (payoff)");
  });

  test("retryCandidate in Story Mode batch preserves narrative role", async () => {
    let callCount = 0;
    const retryPrompts: string[] = [];

    const adapter = new MockAdapter(async (req) => {
      callCount++;
      retryPrompts.push(req.prompt);
      // Fail slide 2 on first attempt
      if (callCount === 2) {
        throw new Error("Temporary network glitch");
      }
      return {
        rawText: JSON.stringify({
          candidates: [
            {
              candidateIndex: 1,
              label: "Story Candidate",
              rationale: "Rationale",
              jsx: "<div style={{ width: 200, height: 100 }}><span>Valid</span></div>",
            },
          ],
        }),
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        durationMs: 5,
        modelId: "mock-model",
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
      prompt: "Story progression",
      candidateCount: 2,
      storyMode: true,
      maxRetries: 0,
    });

    await batch.completionPromise;
    expect(batch.status).toBe("partial_success");

    const failedCandidate = batch.candidates.find(
      (c) => c.candidate.state === "failed",
    );
    expect(failedCandidate).toBeDefined();
    expect(failedCandidate?.candidate.storyArcRole).toBe("payoff");

    if (!failedCandidate) {
      throw new Error("Expected a failed candidate in batch");
    }

    // Retry candidate 2 (payoff)
    const retried = await coordinator.retryCandidate(
      batch.id,
      failedCandidate.candidateId,
    );
    expect(retried.state).toBe("completed");
    expect(retried.storyArcRole).toBe("payoff");

    const lastPrompt = retryPrompts[retryPrompts.length - 1];
    expect(lastPrompt).toContain("Payoff");
  });

  test("startGeneration in Story Mode with count=1 produces single candidate with Hook role", async () => {
    const capturedPrompts: { prompt: string; systemPrompt: string }[] = [];

    const adapter = new MockAdapter(async (req) => {
      capturedPrompts.push({
        prompt: req.prompt,
        systemPrompt: req.systemPrompt ?? "",
      });
      return {
        rawText: JSON.stringify({
          candidates: [
            {
              candidateIndex: 1,
              label: "Single Story Slide",
              rationale: "Rationale",
              jsx: "<div style={{ width: 200, height: 100 }}><span>Slide 1</span></div>",
            },
          ],
        }),
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        durationMs: 5,
        modelId: "mock-model",
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
      prompt: "Single slide story concept",
      candidateCount: 1,
      storyMode: true,
    });

    await batch.completionPromise;
    expect(batch.status).toBe("completed");
    expect(batch.candidates.length).toBe(1);
    expect(batch.candidates[0]?.candidate.storyArcRole).toBe("hook");
    expect(capturedPrompts[0]?.prompt).toContain("Slide 1/1");
    expect(capturedPrompts[0]?.systemPrompt).toContain("HOOK");
  });

  test("startGeneration in Story Mode with count=5 assigns Hook -> Core x3 -> Payoff", async () => {
    const slidePrompts: string[] = [];

    const adapter = new MockAdapter(async (req) => {
      slidePrompts.push(req.prompt);
      return {
        rawText: JSON.stringify({
          candidates: [
            {
              candidateIndex: 1,
              label: "Multi Story Candidate",
              rationale: "Rationale",
              jsx: "<div style={{ width: 200, height: 100 }}><span>Slide</span></div>",
            },
          ],
        }),
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        durationMs: 5,
        modelId: "mock-model",
      };
    });
    providerRegistry.register(adapter);

    const coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
      concurrency: 5,
    });

    const batch = await coordinator.startGeneration({
      sessionId,
      prompt: "5-slide story arc presentation",
      candidateCount: 5,
      storyMode: true,
    });

    await batch.completionPromise;
    expect(batch.status).toBe("completed");
    expect(batch.candidates.length).toBe(5);

    const roles = batch.candidates.map((c) => c.candidate.storyArcRole);
    expect(roles).toEqual(["hook", "core", "core", "core", "payoff"]);

    expect(slidePrompts.length).toBe(5);
    expect(
      slidePrompts.some((p) => p.includes("Slide 1/5") && p.includes("Hook")),
    ).toBe(true);
    expect(
      slidePrompts.some((p) => p.includes("Slide 2/5") && p.includes("Core")),
    ).toBe(true);
    expect(
      slidePrompts.some((p) => p.includes("Slide 3/5") && p.includes("Core")),
    ).toBe(true);
    expect(
      slidePrompts.some((p) => p.includes("Slide 4/5") && p.includes("Core")),
    ).toBe(true);
    expect(
      slidePrompts.some((p) => p.includes("Slide 5/5") && p.includes("Payoff")),
    ).toBe(true);
  });

  test("startGeneration in standard mode (storyMode=false) does not assign storyArcRole", async () => {
    const adapter = new MockAdapter(async () => {
      return {
        rawText: JSON.stringify({
          candidates: [
            {
              candidateIndex: 1,
              label: "Standard Candidate",
              rationale: "Rationale",
              jsx: "<div style={{ width: 200, height: 100 }}><span>Standard</span></div>",
            },
          ],
        }),
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        durationMs: 5,
        modelId: "mock-model",
      };
    });
    providerRegistry.register(adapter);

    const coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
      concurrency: 4,
    });

    const batch = await coordinator.startGeneration({
      sessionId,
      prompt: "4 distinct visual ideas",
      candidateCount: 4,
      storyMode: false,
    });

    await batch.completionPromise;
    expect(batch.status).toBe("completed");
    expect(batch.options.storyMode).toBe(false);
    expect(batch.candidates.length).toBe(4);

    for (const c of batch.candidates) {
      expect(c.candidate.storyArcRole).toBeUndefined();
    }
  });

  test("retryCandidate for middle Core slide preserves core narrative role", async () => {
    let callCount = 0;
    const adapter = new MockAdapter(async (req) => {
      callCount++;
      // Fail slide 2 (Core) on first attempt
      if (callCount === 2) {
        throw new Error("Core slide failure");
      }
      return {
        rawText: JSON.stringify({
          candidates: [
            {
              candidateIndex: 1,
              label: "Core Slide",
              rationale: "Rationale",
              jsx: "<div style={{ width: 200, height: 100 }}><span>Core</span></div>",
            },
          ],
        }),
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        durationMs: 5,
        modelId: "mock-model",
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
      prompt: "3-slide presentation",
      candidateCount: 3,
      storyMode: true,
      maxRetries: 0,
    });

    await batch.completionPromise;
    const coreCandidateRecord = batch.candidates[1];
    expect(coreCandidateRecord?.candidate.state).toBe("failed");
    expect(coreCandidateRecord?.candidate.storyArcRole).toBe("core");

    if (!coreCandidateRecord) {
      throw new Error("Missing candidate record");
    }

    const retried = await coordinator.retryCandidate(
      batch.id,
      coreCandidateRecord.candidateId,
    );
    expect(retried.state).toBe("completed");
    expect(retried.storyArcRole).toBe("core");
  });
});
