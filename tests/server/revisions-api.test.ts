import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { Server } from "bun";
import type { Candidate } from "../../src/domain/candidate";
import type {
  LLMGenerationRequest,
  LLMGenerationResponse,
  ProviderAdapter,
  ProviderMeta,
} from "../../src/domain/provider";
import type { Version } from "../../src/domain/version";
import { GenerationCoordinator } from "../../src/jobs/coordinator";
import { InMemoryKeyStore } from "../../src/llm/keystore";
import { ProviderRegistry } from "../../src/llm/registry";
import { createServer } from "../../src/server/server";
import { SessionService } from "../../src/sessions/service";
import { StyleRegistry } from "../../src/styles/registry";

const TEST_DIR = path.join(
  process.cwd(),
  `tmp-test-revisions-api-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
);

class MockAdapter implements ProviderAdapter {
  readonly id = "mock";
  readonly meta: ProviderMeta = {
    id: "mock",
    name: "Mock Provider",
    supportsCustomBaseUrl: false,
    defaultModelId: "mock-model",
    models: [{ id: "mock-model", name: "Mock Model" }],
  };

  async testConnection() {
    return { success: true, latencyMs: 1, modelId: "mock-model" };
  }

  async generate(_req: LLMGenerationRequest): Promise<LLMGenerationResponse> {
    const validJsx = `<div style={{ display: 'flex', width: 800, height: 800, backgroundColor: '#000000', color: '#ffffff', padding: 32 }}>
  <p style={{ fontSize: 32 }}>Revised Title</p>
</div>`;

    return {
      rawText: JSON.stringify({
        candidates: [
          {
            candidateIndex: 1,
            label: "Revised Design Title",
            rationale: "Dark background with high contrast typography",
            jsx: validJsx,
          },
        ],
      }),
      modelId: "mock-model",
      durationMs: 450,
    };
  }
}

describe("Revisions HTTP API", () => {
  let sessionService: SessionService;
  let keyStore: InMemoryKeyStore;
  let providerRegistry: ProviderRegistry;
  let styleRegistry: StyleRegistry;
  let coordinator: GenerationCoordinator;
  let server: Server<unknown>;
  let sessionId: string;
  let candidateId: string;

  beforeEach(async () => {
    sessionService = new SessionService(TEST_DIR);
    keyStore = new InMemoryKeyStore();
    await keyStore.setKey("mock", "test-api-key");

    providerRegistry = new ProviderRegistry();
    providerRegistry.register(new MockAdapter());
    styleRegistry = new StyleRegistry();

    coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });

    const fullSession = await sessionService.createSession(
      {
        name: "API Revision Test",
        providerId: "mock",
        modelId: "mock-model",
        styleId: "swiss",
        width: 800,
        height: 800,
      },
      "Initial design prompt",
    );
    sessionId = fullSession.id;
    candidateId = "design-001";

    const initialJsx = `<div style={{ display: 'flex', width: 800, height: 800, backgroundColor: '#ffffff', color: '#000000' }}>
  <p>V1</p>
</div>`;

    await sessionService.saveArtifact(
      sessionId,
      "source",
      `${candidateId}-v001.jsx`,
      initialJsx,
    );
    await sessionService.saveArtifact(
      sessionId,
      "svg",
      `${candidateId}-v001.svg`,
      `<svg width="800" height="800"><text>V1</text></svg>`,
    );
    await sessionService.saveArtifact(
      sessionId,
      "images",
      `${candidateId}-v001.png`,
      new Uint8Array([1, 2, 3]),
    );

    const initialCandidate: Candidate = {
      id: candidateId,
      sessionId,
      index: 1,
      state: "completed",
      currentVersionId: "v001",
      label: "Initial V1",
      artifacts: {
        sourcePath: `source/${candidateId}-v001.jsx`,
        svgPath: `svg/${candidateId}-v001.svg`,
        pngPath: `images/${candidateId}-v001.png`,
      },
      versions: [
        {
          id: "v001",
          candidateId,
          versionNumber: 1,
          promptSnapshot: "Initial prompt",
          jsxSourcePath: `source/${candidateId}-v001.jsx`,
          svgPath: `svg/${candidateId}-v001.svg`,
          pngPath: `images/${candidateId}-v001.png`,
          createdAt: new Date().toISOString(),
          label: "Initial V1",
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await sessionService.saveCandidate(sessionId, initialCandidate);

    server = createServer({
      port: 0,
      sessionService,
      keyStore,
      providerRegistry,
      styleRegistry,
      coordinator,
    });
  });

  afterEach(async () => {
    try {
      server.stop();
    } catch {
      // Ignore
    }
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  test("POST /api/sessions/:id/candidates/:candidateId/revisions creates v002", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/sessions/${sessionId}/candidates/${candidateId}/revisions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Change background to black and make text white",
          }),
        },
      ),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      candidate: Candidate;
      version: Version;
    };
    expect(data.version.id).toBe("v002");
    expect(data.version.parentVersionId).toBe("v001");
    expect(data.candidate.currentVersionId).toBe("v002");
    expect(data.candidate.versions?.length).toBe(2);
  });

  test("POST /api/sessions/:id/candidates/:candidateId/revisions accepts explicit providerId and modelId", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/sessions/${sessionId}/candidates/${candidateId}/revisions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Refine typography with custom model",
            providerId: "mock",
            modelId: "custom-mock-model",
          }),
        },
      ),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      candidate: Candidate;
      version: Version;
    };
    expect(data.version.id).toBe("v002");
    expect(data.version.modelMetadata?.providerId).toBe("mock");
  });

  test("POST /api/sessions/:id/candidates/:candidateId/revisions returns 400 on empty prompt", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/sessions/${sessionId}/candidates/${candidateId}/revisions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "   ",
          }),
        },
      ),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("prompt is required");
  });

  test("POST /api/sessions/:id/candidates/:candidateId/revisions returns 404 on unknown candidate", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/sessions/${sessionId}/candidates/unknown-cand/revisions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Valid prompt",
          }),
        },
      ),
    );

    expect(res.status).toBe(404);
  });

  test("GET /api/sessions/:id/candidates/:candidateId/versions lists version history", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/sessions/${sessionId}/candidates/${candidateId}/versions`,
      ),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      versions: Version[];
      currentVersionId: string;
    };
    expect(data.versions.length).toBe(1);
    expect(data.currentVersionId).toBe("v001");
  });

  test("POST /api/sessions/:id/candidates/:candidateId/versions/:versionId/restore restores active version", async () => {
    // 1. Create v002 first
    await server.fetch(
      new Request(
        `http://localhost/api/sessions/${sessionId}/candidates/${candidateId}/revisions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Make revision",
          }),
        },
      ),
    );

    // 2. Restore v001
    const restoreRes = await server.fetch(
      new Request(
        `http://localhost/api/sessions/${sessionId}/candidates/${candidateId}/versions/v001/restore`,
        {
          method: "POST",
        },
      ),
    );

    expect(restoreRes.status).toBe(200);
    const restoreData = (await restoreRes.json()) as {
      candidate: Candidate;
      restoredVersion: Version;
    };
    expect(restoreData.candidate.currentVersionId).toBe("v001");
    expect(restoreData.restoredVersion.id).toBe("v001");
    // Ensure v002 was not deleted
    expect(restoreData.candidate.versions?.length).toBe(2);
  });

  test("POST /api/sessions/:id/candidates/:candidateId/versions/:versionId/restore returns 404 for invalid version", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/sessions/${sessionId}/candidates/${candidateId}/versions/v999/restore`,
        {
          method: "POST",
        },
      ),
    );

    expect(res.status).toBe(404);
  });

  test("POST /api/sessions/:id/candidates/:candidateId/versions/:versionId/restore returns 404 for unknown session", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/sessions/unknown-session/candidates/${candidateId}/versions/v001/restore`,
        {
          method: "POST",
        },
      ),
    );

    expect(res.status).toBe(404);
  });

  test("POST /api/sessions/:id/candidates/:candidateId/versions/:versionId/restore returns 404 for unknown candidate", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/sessions/${sessionId}/candidates/unknown-candidate/versions/v001/restore`,
        {
          method: "POST",
        },
      ),
    );

    expect(res.status).toBe(404);
  });

  test("POST /api/sessions/:id/candidates/:candidateId/revisions returns 404 for unknown session", async () => {
    const res = await server.fetch(
      new Request(
        `http://localhost/api/sessions/unknown-session/candidates/${candidateId}/revisions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "Valid prompt" }),
        },
      ),
    );

    expect(res.status).toBe(404);
  });

  test("POST multiple sequential revisions through API builds cumulative version history", async () => {
    // Create v002
    const resV2 = await server.fetch(
      new Request(
        `http://localhost/api/sessions/${sessionId}/candidates/${candidateId}/revisions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "Revision to v002" }),
        },
      ),
    );
    expect(resV2.status).toBe(200);

    // Create v003
    const resV3 = await server.fetch(
      new Request(
        `http://localhost/api/sessions/${sessionId}/candidates/${candidateId}/revisions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "Revision to v003" }),
        },
      ),
    );
    expect(resV3.status).toBe(200);
    const dataV3 = (await resV3.json()) as {
      candidate: Candidate;
      version: Version;
    };
    expect(dataV3.version.id).toBe("v003");
    expect(dataV3.version.parentVersionId).toBe("v002");
    expect(dataV3.candidate.currentVersionId).toBe("v003");
    expect(dataV3.candidate.versions?.length).toBe(3);

    // Verify GET /versions reflects all 3
    const listRes = await server.fetch(
      new Request(
        `http://localhost/api/sessions/${sessionId}/candidates/${candidateId}/versions`,
      ),
    );
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as {
      versions: Version[];
      currentVersionId: string;
    };
    expect(listData.versions.length).toBe(3);
    expect(listData.currentVersionId).toBe("v003");
    expect(listData.versions.map((v) => v.id)).toEqual([
      "v001",
      "v002",
      "v003",
    ]);
  });
});
