import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { CandidateState } from "../../src/domain/candidate";
import { ProviderError } from "../../src/domain/errors";
import type {
  LLMGenerationRequest,
  LLMGenerationResponse,
  ProviderAdapter,
  ProviderMeta,
} from "../../src/domain/provider";
import { executeCandidateJob } from "../../src/jobs/executor";
import { SessionService } from "../../src/sessions/service";

const TEST_DIR = path.join(process.cwd(), `tmp-test-executor-${Date.now()}`);

class MockProviderAdapter implements ProviderAdapter {
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
    return { success: true, latencyMs: 5, modelId: "mock-model" };
  }

  async generate(
    request: LLMGenerationRequest,
  ): Promise<LLMGenerationResponse> {
    return this.generateFn(request);
  }
}

describe("Candidate Job Executor", () => {
  let sessionService: SessionService;
  let sessionId: string;

  beforeEach(async () => {
    sessionService = new SessionService(TEST_DIR);
    const session = await sessionService.createSession({
      name: "Executor Test",
      providerId: "mock",
      modelId: "mock-model",
      styleId: "tech-spec",
      width: 200,
      height: 100,
    });
    sessionId = session.id;
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  test("runs successful candidate end-to-end with full lifecycle and artifact persistence", async () => {
    const validPayload = JSON.stringify({
      label: "Hero Card",
      rationale: "Clean layout for developer docs",
      jsx: "<div style={{ display: 'flex', width: 200, height: 100, backgroundColor: '#111', color: '#fff', alignItems: 'center', justifyContent: 'center' }}>Renderloom</div>",
    });

    const mockAdapter = new MockProviderAdapter(async () => ({
      rawText: validPayload,
      modelId: "mock-model",
      durationMs: 50,
    }));

    const statesSeen: CandidateState[] = [];

    const candidate = await executeCandidateJob({
      sessionId,
      candidateId: "design-001",
      index: 1,
      prompt: "Create a hero card",
      providerAdapter: mockAdapter,
      modelId: "mock-model",
      apiKey: "test-key",
      width: 200,
      height: 100,
      sessionService,
      onUpdate: (c) => statesSeen.push(c.state),
    });

    expect(candidate.state).toBe("completed");
    expect(candidate.label).toBe("Hero Card");
    expect(candidate.rationale).toBe("Clean layout for developer docs");
    expect(candidate.artifacts?.sourcePath).toBe("source/design-001-v001.jsx");
    expect(candidate.artifacts?.svgPath).toBe("svg/design-001-v001.svg");
    expect(candidate.artifacts?.pngPath).toBe("images/design-001-v001.png");

    expect(statesSeen).toContain("generating");
    expect(statesSeen).toContain("validating");
    expect(statesSeen).toContain("rendering");
    expect(statesSeen).toContain("completed");

    expect(candidate.timings?.queuedAt).toBeDefined();
    expect(candidate.timings?.generationStartedAt).toBeDefined();
    expect(candidate.timings?.generationEndedAt).toBeDefined();
    expect(candidate.timings?.validationStartedAt).toBeDefined();
    expect(candidate.timings?.validationEndedAt).toBeDefined();
    expect(candidate.timings?.renderingStartedAt).toBeDefined();
    expect(candidate.timings?.renderingEndedAt).toBeDefined();
    expect(candidate.timings?.completedAt).toBeDefined();

    // Verify artifact files exist on disk
    const pngPath = await sessionService.getArtifactPath(
      sessionId,
      "images",
      "design-001-v001.png",
    );
    expect(pngPath.mimeType).toBe("image/png");

    const svgPath = await sessionService.getArtifactPath(
      sessionId,
      "svg",
      "design-001-v001.svg",
    );
    expect(svgPath.mimeType).toBe("image/svg+xml");

    const sourcePath = await sessionService.getArtifactPath(
      sessionId,
      "source",
      "design-001-v001.jsx",
    );
    expect(sourcePath.mimeType).toContain("text/plain");

    // Verify session metadata was updated
    const savedCandidates = await sessionService.getCandidates(sessionId);
    expect(savedCandidates.length).toBe(1);
    const [firstCandidate] = savedCandidates;
    expect(firstCandidate?.state).toBe("completed");
  });

  test("handles transient retry and backoff", async () => {
    let callCount = 0;
    const validPayload = JSON.stringify({
      label: "Retry Card",
      rationale: "Works after retry",
      jsx: "<div style={{ width: 200, height: 100, color: '#fff' }}>OK</div>",
    });

    const mockAdapter = new MockProviderAdapter(async () => {
      callCount++;
      if (callCount === 1) {
        throw new ProviderError("RATE_LIMITED", "Too many requests");
      }
      return {
        rawText: validPayload,
        modelId: "mock-model",
        durationMs: 20,
      };
    });

    const candidate = await executeCandidateJob({
      sessionId,
      candidateId: "design-002",
      index: 2,
      prompt: "Prompt",
      providerAdapter: mockAdapter,
      modelId: "mock-model",
      apiKey: "test-key",
      width: 200,
      height: 100,
      sessionService,
      retryBaseDelayMs: 1, // minimal delay for test
    });

    expect(callCount).toBe(2);
    expect(candidate.state).toBe("completed");
    expect(candidate.retries).toBe(1);
  });

  test("marks candidate failed without retrying permanent validation errors", async () => {
    let callCount = 0;
    const mockAdapter = new MockProviderAdapter(async () => {
      callCount++;
      return {
        rawText: "{ broken json",
        modelId: "mock-model",
        durationMs: 10,
      };
    });

    const candidate = await executeCandidateJob({
      sessionId,
      candidateId: "design-003",
      index: 3,
      prompt: "Prompt",
      providerAdapter: mockAdapter,
      modelId: "mock-model",
      apiKey: "test-key",
      width: 200,
      height: 100,
      sessionService,
    });

    expect(callCount).toBe(1);
    expect(candidate.state).toBe("failed");
    expect(candidate.errorCode).toBe("VALIDATION_ERROR");
  });

  test("marks candidate cancelled when aborted during generation", async () => {
    const controller = new AbortController();

    const mockAdapter = new MockProviderAdapter(async (req) => {
      const { promise, reject } =
        Promise.withResolvers<LLMGenerationResponse>();
      req.signal?.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
      return promise;
    });

    const promise = executeCandidateJob({
      sessionId,
      candidateId: "design-004",
      index: 4,
      prompt: "Prompt",
      providerAdapter: mockAdapter,
      modelId: "mock-model",
      apiKey: "test-key",
      width: 200,
      height: 100,
      sessionService,
      signal: controller.signal,
    });

    controller.abort();
    const candidate = await promise;

    expect(candidate.state).toBe("cancelled");
    expect(candidate.errorMessage).toContain("Cancelled");
  });
});
