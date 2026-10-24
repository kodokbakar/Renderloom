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

const TEST_DIR = path.join(
  process.cwd(),
  `tmp-test-revision-exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

describe("Revision Execution Pipeline & Failure Safety", () => {
  let sessionService: SessionService;
  let keyStore: InMemoryKeyStore;
  let providerRegistry: ProviderRegistry;
  let styleRegistry: StyleRegistry;
  let coordinator: GenerationCoordinator;
  let sessionId: string;
  let candidateId: string;

  beforeEach(async () => {
    sessionService = new SessionService(TEST_DIR);
    keyStore = new InMemoryKeyStore();
    await keyStore.setKey("mock", "mock-key");

    providerRegistry = new ProviderRegistry();
    styleRegistry = new StyleRegistry();

    // Initial session
    const fullSession = await sessionService.createSession(
      {
        name: "Revision Test Session",
        providerId: "mock",
        modelId: "mock-model",
        styleId: "swiss",
        width: 800,
        height: 800,
      },
      "Initial design prompt",
    );
    sessionId = fullSession.id;

    // Save initial completed candidate with v001 artifacts
    candidateId = "design-001";
    const initialJsx = `<div style={{ display: 'flex', width: 800, height: 800, backgroundColor: '#ffffff', color: '#000000', padding: 40 }}>
  <p style={{ fontSize: 36, fontWeight: 700 }}>Version 1 Layout</p>
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
      new Uint8Array([1, 2, 3, 4]),
    );

    const initialCandidate: Candidate = {
      id: candidateId,
      sessionId,
      index: 1,
      state: "completed",
      currentVersionId: "v001",
      label: "Initial V1",
      rationale: "Clean Swiss grid",
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
          rationale: "Clean Swiss grid",
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await sessionService.saveCandidate(sessionId, initialCandidate);
  });

  afterEach(async () => {
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  test("successfully revises candidate into v002 and keeps v001 intact", async () => {
    const v2Jsx = `<div style={{ display: 'flex', width: 800, height: 800, backgroundColor: '#0f172a', color: '#f8fafc', padding: 40 }}>
  <p style={{ fontSize: 44, fontWeight: 800 }}>Version 2 Dark Theme</p>
</div>`;

    const adapter = new MockAdapter(async () => ({
      rawText: JSON.stringify({
        candidates: [
          {
            candidateIndex: 1,
            label: "Version 2 Dark Mode",
            rationale: "Inverted colors for high contrast",
            jsx: v2Jsx,
          },
        ],
      }),
      modelId: "mock-model",
      durationMs: 800,
    }));
    providerRegistry.register(adapter);

    coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });

    const result = await coordinator.reviseCandidate({
      sessionId,
      candidateId,
      prompt: "Make the background dark slate and text white",
    });

    expect(result.version.id).toBe("v002");
    expect(result.version.versionNumber).toBe(2);
    expect(result.version.parentVersionId).toBe("v001");
    expect(result.candidate.currentVersionId).toBe("v002");
    expect(result.candidate.versions?.length).toBe(2);

    // Verify v001 still exists in candidate version tree
    const v1 = result.candidate.versions?.find((v) => v.id === "v001");
    expect(v1).toBeDefined();
    expect(v1?.jsxSourcePath).toBe(`source/${candidateId}-v001.jsx`);

    // Verify v002 artifacts exist on disk
    const v2Artifact = await sessionService.getArtifactPath(
      sessionId,
      "source",
      `${candidateId}-v002.jsx`,
    );
    expect(v2Artifact.filePath).toBeDefined();

    // Verify v001 artifact still exists on disk
    const v1Artifact = await sessionService.getArtifactPath(
      sessionId,
      "source",
      `${candidateId}-v001.jsx`,
    );
    expect(v1Artifact.filePath).toBeDefined();
  });

  test("failure safety: failed revision does not replace current version or delete artifacts", async () => {
    // Adapter returns invalid JSX with unsafe eval
    const adapter = new MockAdapter(async () => ({
      rawText: JSON.stringify({
        candidates: [
          {
            candidateIndex: 1,
            label: "Malicious Revision",
            rationale: "Attempts script eval",
            jsx: `<div style={{ width: 800, height: 800 }}>{eval('1+1')}</div>`,
          },
        ],
      }),
      modelId: "mock-model",
      durationMs: 400,
    }));
    providerRegistry.register(adapter);

    coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });

    // Revision should fail validation
    expect(
      coordinator.reviseCandidate({
        sessionId,
        candidateId,
        prompt: "Inject dynamic code",
      }),
    ).rejects.toThrow();

    // Reload candidate from session service
    const candidates = await sessionService.getCandidates(sessionId);
    const candidate = candidates.find((c) => c.id === candidateId);
    expect(candidate).toBeDefined();

    // Active version must stay v001
    expect(candidate?.currentVersionId).toBe("v001");
    expect(candidate?.artifacts?.sourcePath).toBe(
      `source/${candidateId}-v001.jsx`,
    );

    // Error must be recorded
    expect(candidate?.lastRevisionError).toBeDefined();
    expect(candidate?.lastRevisionError?.parentVersionId).toBe("v001");
    expect(candidate?.lastRevisionError?.message).toContain("eval");

    // v001 artifact still exists and accessible
    const v1Artifact = await sessionService.getArtifactPath(
      sessionId,
      "source",
      `${candidateId}-v001.jsx`,
    );
    expect(v1Artifact.filePath).toBeDefined();
  });

  test("restore historical version switches active pointer without deleting later versions", async () => {
    const v2Jsx = `<div style={{ display: 'flex', width: 800, height: 800, backgroundColor: '#000000', color: '#ffffff' }}>
  <p>V2</p>
</div>`;

    const adapter = new MockAdapter(async () => ({
      rawText: JSON.stringify({
        candidates: [
          {
            candidateIndex: 1,
            label: "V2 Label",
            rationale: "V2 Rationale",
            jsx: v2Jsx,
          },
        ],
      }),
      modelId: "mock-model",
      durationMs: 500,
    }));
    providerRegistry.register(adapter);

    coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });

    // Create v002
    await coordinator.reviseCandidate({
      sessionId,
      candidateId,
      prompt: "Create v2",
    });

    // Now restore v001
    const restoreResult = await coordinator.restoreCandidateVersion(
      sessionId,
      candidateId,
      "v001",
    );

    expect(restoreResult.candidate.currentVersionId).toBe("v001");
    expect(restoreResult.candidate.artifacts?.sourcePath).toBe(
      `source/${candidateId}-v001.jsx`,
    );
    // Both v001 and v002 must still be in candidate.versions
    expect(restoreResult.candidate.versions?.length).toBe(2);
    expect(
      restoreResult.candidate.versions?.some((v) => v.id === "v002"),
    ).toBeTrue();
  });

  test("branching: revising from restored version creates next version with explicit parentVersionId", async () => {
    let callCount = 0;
    const adapter = new MockAdapter(async () => {
      callCount++;
      return {
        rawText: JSON.stringify({
          candidates: [
            {
              candidateIndex: 1,
              label: `Variant ${callCount + 1}`,
              rationale: `Rationale ${callCount + 1}`,
              jsx: `<div style={{ display: 'flex', width: 800, height: 800, backgroundColor: '#${callCount}${callCount}${callCount}000' }}>
  <p>Variant ${callCount + 1}</p>
</div>`,
            },
          ],
        }),
        modelId: "mock-model",
        durationMs: 500,
      };
    });
    providerRegistry.register(adapter);

    coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });

    // Step 1: Revise to v002
    const v2Result = await coordinator.reviseCandidate({
      sessionId,
      candidateId,
      prompt: "First revision to v002",
    });
    expect(v2Result.version.id).toBe("v002");

    // Step 2: Restore v001
    await coordinator.restoreCandidateVersion(sessionId, candidateId, "v001");

    // Step 3: Revise from restored active version (v001) -> branches into v003
    const v3Result = await coordinator.reviseCandidate({
      sessionId,
      candidateId,
      prompt: "Branch from v001 into alternative v003",
    });

    expect(v3Result.version.id).toBe("v003");
    expect(v3Result.version.versionNumber).toBe(3);
    expect(v3Result.version.parentVersionId).toBe("v001"); // branched from restored v001!
    expect(v3Result.candidate.versions?.length).toBe(3);
    expect(v3Result.candidate.versions?.map((v) => v.id)).toEqual([
      "v001",
      "v002",
      "v003",
    ]);
  });

  test("consecutive revisions create v002 -> v003 -> v004 with linear parent chain and intact artifacts", async () => {
    let step = 1;
    const adapter = new MockAdapter(async () => {
      step++;
      return {
        rawText: JSON.stringify({
          candidates: [
            {
              candidateIndex: 1,
              label: `Version ${step} Layout`,
              rationale: `Step ${step} rationale`,
              jsx: `<div style={{ display: 'flex', width: 800, height: 800, backgroundColor: '#${step}${step}${step}fff' }}><p>V${step}</p></div>`,
            },
          ],
        }),
        modelId: "mock-model",
        durationMs: 200,
      };
    });
    providerRegistry.register(adapter);

    coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });

    const res2 = await coordinator.reviseCandidate({
      sessionId,
      candidateId,
      prompt: "Make v002",
    });
    expect(res2.version.id).toBe("v002");
    expect(res2.version.parentVersionId).toBe("v001");

    const res3 = await coordinator.reviseCandidate({
      sessionId,
      candidateId,
      prompt: "Make v003",
    });
    expect(res3.version.id).toBe("v003");
    expect(res3.version.parentVersionId).toBe("v002");

    const res4 = await coordinator.reviseCandidate({
      sessionId,
      candidateId,
      prompt: "Make v004",
    });
    expect(res4.version.id).toBe("v004");
    expect(res4.version.parentVersionId).toBe("v003");
    expect(res4.candidate.currentVersionId).toBe("v004");
    expect(res4.candidate.versions?.length).toBe(4);

    // Ensure all 4 versions exist as distinct artifacts on disk
    for (const vId of ["v001", "v002", "v003", "v004"]) {
      const art = await sessionService.getArtifactPath(
        sessionId,
        "source",
        `${candidateId}-${vId}.jsx`,
      );
      expect(art.filePath).toBeDefined();
    }
  });

  test("branching from middle version v002 when v003 exists creates v004 with parentVersionId: v002", async () => {
    let count = 1;
    const adapter = new MockAdapter(async () => {
      count++;
      return {
        rawText: JSON.stringify({
          candidates: [
            {
              candidateIndex: 1,
              label: `Branch Variant ${count}`,
              rationale: `Rationale ${count}`,
              jsx: `<div style={{ display: 'flex', width: 800, height: 800, backgroundColor: '#00${count}${count}00' }}><p>B${count}</p></div>`,
            },
          ],
        }),
        modelId: "mock-model",
        durationMs: 200,
      };
    });
    providerRegistry.register(adapter);

    coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });

    // Create v002 and v003 sequentially
    await coordinator.reviseCandidate({
      sessionId,
      candidateId,
      prompt: "Go to v002",
    });
    const v3 = await coordinator.reviseCandidate({
      sessionId,
      candidateId,
      prompt: "Go to v003",
    });
    expect(v3.candidate.currentVersionId).toBe("v003");
    expect(v3.candidate.versions?.length).toBe(3);

    // Restore v002 (middle version)
    const restored = await coordinator.restoreCandidateVersion(
      sessionId,
      candidateId,
      "v002",
    );
    expect(restored.candidate.currentVersionId).toBe("v002");

    // Now branch from restored v002
    const v4 = await coordinator.reviseCandidate({
      sessionId,
      candidateId,
      prompt: "Branch from v002 into alternative v004",
    });
    expect(v4.version.id).toBe("v004");
    expect(v4.version.versionNumber).toBe(4);
    expect(v4.version.parentVersionId).toBe("v002");
    expect(v4.candidate.currentVersionId).toBe("v004");
    expect(v4.candidate.versions?.length).toBe(4);
    expect(v4.candidate.versions?.map((v) => v.id)).toEqual([
      "v001",
      "v002",
      "v003",
      "v004",
    ]);
  });

  test("handles special characters, unicode, and emojis in revision prompt end-to-end", async () => {
    const adapter = new MockAdapter(async (req) => {
      expect(req.prompt).toContain("🎨 Add 'bold' & \"radiant\" glow ✨");
      return {
        rawText: JSON.stringify({
          candidates: [
            {
              candidateIndex: 1,
              label: "Emoji & Quotes Variant",
              rationale: "Successfully processed special chars",
              jsx: `<div style={{ display: 'flex', width: 800, height: 800, backgroundColor: '#ffffff' }}><p>Special</p></div>`,
            },
          ],
        }),
        modelId: "mock-model",
        durationMs: 200,
      };
    });
    providerRegistry.register(adapter);

    coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });

    const res = await coordinator.reviseCandidate({
      sessionId,
      candidateId,
      prompt: "🎨 Add 'bold' & \"radiant\" glow ✨",
    });

    expect(res.version.id).toBe("v002");
    expect(res.version.revisionPrompt).toBe(
      "🎨 Add 'bold' & \"radiant\" glow ✨",
    );
  });

  test("restoreCandidateVersion throws ValidationError on non-existent version or candidate", async () => {
    coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });

    // Non-existent version
    expect(
      coordinator.restoreCandidateVersion(sessionId, candidateId, "v999"),
    ).rejects.toThrow(ValidationError);

    // Non-existent candidate
    expect(
      coordinator.restoreCandidateVersion(
        sessionId,
        "non-existent-candidate",
        "v001",
      ),
    ).rejects.toThrow(ValidationError);
  });

  test("reviseCandidate throws ValidationError on non-existent parentVersionId", async () => {
    coordinator = new GenerationCoordinator({
      sessionService,
      providerRegistry,
      keyStore,
      styleRegistry,
    });

    expect(
      coordinator.reviseCandidate({
        sessionId,
        candidateId,
        prompt: "Invalid parent",
        parentVersionId: "v999",
      }),
    ).rejects.toThrow(ValidationError);
  });
});
