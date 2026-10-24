import { describe, expect, test } from "bun:test";
import type { Candidate, RevisionError } from "../../src/domain/candidate";
import type { ConversationMessage } from "../../src/domain/session";
import type { SafeModelMetadata, Version } from "../../src/domain/version";

describe("Phase 7 Domain Contracts", () => {
  test("SafeModelMetadata enforces structured model info without secrets", () => {
    const meta: SafeModelMetadata = {
      providerId: "openai",
      modelId: "gpt-4o",
      durationMs: 1250,
      usage: {
        promptTokens: 450,
        completionTokens: 820,
        totalTokens: 1270,
      },
    };

    expect(meta.providerId).toBe("openai");
    expect(meta.modelId).toBe("gpt-4o");
    expect(meta.durationMs).toBe(1250);
    expect(meta.usage?.totalTokens).toBe(1270);
  });

  test("Version interface supports immutable multi-version chains and parent references", () => {
    const v1: Version = {
      id: "v001",
      candidateId: "design-001",
      versionNumber: 1,
      promptSnapshot: "Initial prompt snapshot",
      jsxSourcePath: "source/design-001-v001.jsx",
      svgPath: "svg/design-001-v001.svg",
      pngPath: "images/design-001-v001.png",
      createdAt: "2026-10-24T12:00:00.000Z",
      label: "Initial Grid Layout",
      rationale: "Clean spacing and bold title",
    };

    const v2: Version = {
      id: "v002",
      candidateId: "design-001",
      versionNumber: 2,
      parentVersionId: "v001",
      promptSnapshot: "Revision prompt snapshot",
      revisionPrompt: "Make the headline bolder and add warm background",
      jsxSourcePath: "source/design-001-v002.jsx",
      svgPath: "svg/design-001-v002.svg",
      pngPath: "images/design-001-v002.png",
      createdAt: "2026-10-24T12:05:00.000Z",
      label: "Warm Bold Headline Variant",
      rationale: "Increased font weight to 800 and set background to #fef3c7",
      modelMetadata: {
        providerId: "openai",
        modelId: "gpt-4o",
        durationMs: 1100,
      },
    };

    expect(v1.versionNumber).toBe(1);
    expect(v1.parentVersionId).toBeUndefined();
    expect(v2.parentVersionId).toBe("v001");
    expect(v2.versionNumber).toBe(2);
    expect(v2.revisionPrompt).toBe(
      "Make the headline bolder and add warm background",
    );
  });

  test("Candidate interface supports version trees and revision error tracking", () => {
    const revisionError: RevisionError = {
      message: "AST syntax error: Unexpected token",
      code: "VALIDATION_FAILED",
      parentVersionId: "v001",
      attemptedAt: "2026-10-24T12:10:00.000Z",
    };

    const candidate: Candidate = {
      id: "design-001",
      sessionId: "session-1",
      index: 1,
      state: "completed",
      currentVersionId: "v001",
      versions: [
        {
          id: "v001",
          candidateId: "design-001",
          versionNumber: 1,
          promptSnapshot: "Snapshot",
          jsxSourcePath: "source/design-001-v001.jsx",
          svgPath: "svg/design-001-v001.svg",
          pngPath: "images/design-001-v001.png",
          createdAt: "2026-10-24T12:00:00.000Z",
        },
      ],
      lastRevisionError: revisionError,
      createdAt: "2026-10-24T12:00:00.000Z",
      updatedAt: "2026-10-24T12:10:00.000Z",
    };

    expect(candidate.versions?.length).toBe(1);
    expect(candidate.currentVersionId).toBe("v001");
    expect(candidate.lastRevisionError?.code).toBe("VALIDATION_FAILED");
    expect(candidate.lastRevisionError?.parentVersionId).toBe("v001");
  });

  test("ConversationMessage supports versionId link", () => {
    const msg: ConversationMessage = {
      id: "msg-1",
      role: "user",
      content: "Make it darker",
      timestamp: "2026-10-24T12:15:00.000Z",
      candidateId: "design-001",
      versionId: "v002",
    };

    expect(msg.versionId).toBe("v002");
    expect(msg.candidateId).toBe("design-001");
  });
});
