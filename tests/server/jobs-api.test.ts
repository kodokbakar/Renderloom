import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { Server } from "bun";
import type {
  LLMGenerationRequest,
  LLMGenerationResponse,
  ProviderAdapter,
  ProviderMeta,
} from "../../src/domain/provider";
import { GenerationCoordinator } from "../../src/jobs/coordinator";
import { InMemoryKeyStore } from "../../src/llm/keystore";
import { ProviderRegistry } from "../../src/llm/registry";
import { createServer } from "../../src/server/server";
import { SessionService } from "../../src/sessions/service";
import { StyleRegistry } from "../../src/styles/registry";

const TEST_DIR = path.join(process.cwd(), `tmp-test-jobs-api-${Date.now()}`);

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

describe("Jobs HTTP API", () => {
  let sessionService: SessionService;
  let keyStore: InMemoryKeyStore;
  let providerRegistry: ProviderRegistry;
  let styleRegistry: StyleRegistry;
  let coordinator: GenerationCoordinator;
  let server: Server<unknown>;
  let baseUrl: string;
  let sessionId: string;

  beforeEach(async () => {
    sessionService = new SessionService(TEST_DIR);
    keyStore = new InMemoryKeyStore();
    await keyStore.setKey("mock", "test-key");

    providerRegistry = new ProviderRegistry();
    styleRegistry = new StyleRegistry();

    coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
      concurrency: 2,
    });

    server = createServer({
      port: 0,
      sessionService,
      keyStore,
      providerRegistry,
      styleRegistry,
      coordinator,
    });
    baseUrl = `http://localhost:${server.port}`;

    const session = await sessionService.createSession({
      name: "API Test",
      providerId: "mock",
      modelId: "mock-model",
      styleId: "minimal",
      width: 200,
      height: 100,
    });
    sessionId = session.id;
  });

  afterEach(async () => {
    server.stop();
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  test("POST /api/generations starts a batch and GET returns view", async () => {
    let callIndex = 0;
    const adapter = new MockAdapter(async () => {
      callIndex++;
      return {
        rawText: JSON.stringify({
          label: `Card ${callIndex}`,
          rationale: "Clean layout",
          jsx: "<div style={{ width: 200, height: 100, color: '#fff' }}>Card</div>",
        }),
        modelId: "mock-model",
        durationMs: 10,
      };
    });
    providerRegistry.register(adapter);

    const res = await fetch(`${baseUrl}/api/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        prompt: "Generate hero banner",
        candidateCount: 2,
      }),
    });

    expect(res.status).toBe(202);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.batchId).toBeDefined();
    expect(data.sessionId).toBe(sessionId);
    expect(Array.isArray(data.candidates)).toBe(true);
    expect((data.candidates as unknown[]).length).toBe(2);

    const batchId = data.batchId as string;

    // Wait for completion
    const batch = coordinator.getBatch(batchId);
    expect(batch).toBeDefined();
    await batch?.completionPromise;

    // GET /api/generations/:batchId
    const getRes = await fetch(`${baseUrl}/api/generations/${batchId}`);
    expect(getRes.status).toBe(200);
    const getData = (await getRes.json()) as {
      batch: { status: string; candidates: unknown[] };
    };
    expect(getData.batch.status).toBe("completed");
    expect(getData.batch.candidates.length).toBe(2);

    // GET /api/sessions/:id/candidates
    const sessionRes = await fetch(
      `${baseUrl}/api/sessions/${sessionId}/candidates`,
    );
    expect(sessionRes.status).toBe(200);
    const sessionData = (await sessionRes.json()) as { candidates: unknown[] };
    expect(sessionData.candidates.length).toBe(2);
  });

  test("POST /api/generations rejects invalid payload", async () => {
    const resNoPrompt = await fetch(`${baseUrl}/api/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    expect(resNoPrompt.status).toBe(400);

    const resNoSession = await fetch(`${baseUrl}/api/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Hello" }),
    });
    expect(resNoSession.status).toBe(400);
  });

  test("POST /api/generations/:batchId/cancel cancels a batch", async () => {
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

    const startRes = await fetch(`${baseUrl}/api/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        prompt: "Will be cancelled",
        candidateCount: 1,
      }),
    });
    const { batchId } = (await startRes.json()) as { batchId: string };

    const cancelRes = await fetch(
      `${baseUrl}/api/generations/${batchId}/cancel`,
      {
        method: "POST",
      },
    );
    expect(cancelRes.status).toBe(200);
    const cancelData = (await cancelRes.json()) as { cancelled: boolean };
    expect(cancelData.cancelled).toBe(true);

    const batch = coordinator.getBatch(batchId);
    await batch?.completionPromise;
    expect(batch?.status).toBe("cancelled");
  });

  test("POST /api/generations/:batchId/candidates/:candidateId/retry retries failed candidate", async () => {
    let calls = 0;
    const adapter = new MockAdapter(async () => {
      calls++;
      if (calls === 1) {
        return {
          rawText: "invalid json",
          modelId: "mock-model",
          durationMs: 5,
        };
      }
      return {
        rawText: JSON.stringify({
          label: "Fixed",
          rationale: "Works now",
          jsx: "<div style={{ width: 200, height: 100 }}>Fixed</div>",
        }),
        modelId: "mock-model",
        durationMs: 5,
      };
    });
    providerRegistry.register(adapter);

    const startRes = await fetch(`${baseUrl}/api/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        prompt: "Fail and retry",
        candidateCount: 1,
      }),
    });
    const { batchId } = (await startRes.json()) as { batchId: string };

    const batch = coordinator.getBatch(batchId);
    await batch?.completionPromise;
    expect(batch?.status).toBe("failed");

    // Retry candidate
    const retryRes = await fetch(
      `${baseUrl}/api/generations/${batchId}/candidates/design-001/retry`,
      { method: "POST" },
    );
    expect(retryRes.status).toBe(200);
    const retryData = (await retryRes.json()) as {
      candidate: { state: string; label: string };
    };
    expect(retryData.candidate.state).toBe("completed");
    expect(retryData.candidate.label).toBe("Fixed");
  });

  test("GET /api/generations/:batchId/events connects to SSE stream", async () => {
    const adapter = new MockAdapter(async () => ({
      rawText: JSON.stringify({
        label: "SSE Card",
        rationale: "Rationale",
        jsx: "<div style={{ width: 200, height: 100 }}>SSE</div>",
      }),
      modelId: "mock-model",
      durationMs: 10,
    }));
    providerRegistry.register(adapter);

    const startRes = await fetch(`${baseUrl}/api/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        prompt: "SSE Stream test",
        candidateCount: 1,
      }),
    });
    const { batchId } = (await startRes.json()) as { batchId: string };

    const eventRes = await fetch(
      `${baseUrl}/api/generations/${batchId}/events`,
    );
    expect(eventRes.status).toBe(200);
    expect(eventRes.headers.get("content-type")).toContain("text/event-stream");

    const reader = eventRes.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let accumulated = "";

    while (reader) {
      const { done, value } = await reader.read();
      accumulated += decoder.decode(value, { stream: true });
      if (accumulated.includes("event: batch_completed")) {
        break;
      }
    }

    expect(accumulated).toContain("event: snapshot");
    expect(accumulated).toContain("event: batch_completed");
  });
});
