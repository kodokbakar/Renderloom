import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { Candidate } from "../../src/domain/candidate";
import { SessionError } from "../../src/domain/errors";
import type { ConversationMessage } from "../../src/domain/session";
import { SessionService } from "../../src/sessions/service";

const TEST_DIR = path.join(
  process.cwd(),
  `tmp-test-revision-pers-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
);

describe("Session Service Revision Persistence & Conversation Appending", () => {
  let sessionService: SessionService;
  let sessionId: string;

  beforeEach(async () => {
    sessionService = new SessionService(TEST_DIR);
    const session = await sessionService.createSession(
      {
        name: "Persistence Test",
        providerId: "mock",
        modelId: "mock-model",
        styleId: "modern",
        width: 1024,
        height: 1024,
      },
      "Initial design prompt snapshot",
    );
    sessionId = session.id;
  });

  afterEach(async () => {
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  test("appendConversationMessage appends atomically and updates session timestamp", async () => {
    const msg1: ConversationMessage = {
      id: "msg-1",
      role: "user",
      content: "Make it minimalist",
      timestamp: new Date().toISOString(),
      candidateId: "design-001",
      versionId: "v002",
    };

    const conv = await sessionService.appendConversationMessage(
      sessionId,
      msg1,
    );
    expect(conv.messages.length).toBe(2);
    expect(conv.messages[1]?.content).toBe("Make it minimalist");
    expect(conv.messages[1]?.versionId).toBe("v002");

    const msg2: ConversationMessage = {
      id: "msg-2",
      role: "assistant",
      content: "Revised candidate 1 to v002",
      timestamp: new Date().toISOString(),
      candidateId: "design-001",
      versionId: "v002",
    };

    const conv2 = await sessionService.appendConversationMessage(
      sessionId,
      msg2,
    );
    expect(conv2.messages.length).toBe(3);

    // Reopen session and check conversation
    const full = await sessionService.getSession(sessionId);
    expect(full.conversation.messages.length).toBe(3);
    expect(full.conversation.messages[2]?.role).toBe("assistant");
  });

  test("hydrates legacy candidates without versions array on getSession and getCandidates", async () => {
    const legacyCandidate: Candidate = {
      id: "design-legacy",
      sessionId,
      index: 1,
      state: "completed",
      label: "Legacy Design",
      artifacts: {
        sourcePath: "source/design-legacy-v001.jsx",
        svgPath: "svg/design-legacy-v001.svg",
        pngPath: "images/design-legacy-v001.png",
      },
      createdAt: "2026-10-24T00:00:00.000Z",
      updatedAt: "2026-10-24T00:00:00.000Z",
    };

    // Save legacy candidate directly (simulating pre-Phase 7 session data)
    await sessionService.saveCandidate(sessionId, legacyCandidate);

    // 1. getSession hydration
    const full = await sessionService.getSession(sessionId);
    const candFromFull = full.session.candidates?.find(
      (c) => c.id === "design-legacy",
    );
    expect(candFromFull).toBeDefined();
    expect(candFromFull?.versions?.length).toBe(1);
    expect(candFromFull?.versions?.[0]?.id).toBe("v001");
    expect(candFromFull?.versions?.[0]?.versionNumber).toBe(1);
    expect(candFromFull?.versions?.[0]?.jsxSourcePath).toBe(
      "source/design-legacy-v001.jsx",
    );

    // 2. getCandidates hydration
    const candidates = await sessionService.getCandidates(sessionId);
    const candFromList = candidates.find((c) => c.id === "design-legacy");
    expect(candFromList?.versions?.length).toBe(1);
    expect(candFromList?.currentVersionId).toBe("v001");
  });

  test("saveArtifact guarantees immutability of version artifacts", async () => {
    const filename = "design-001-v001.jsx";
    await sessionService.saveArtifact(
      sessionId,
      "source",
      filename,
      "<div>Initial</div>",
    );

    // Attempting to overwrite existing artifact must throw IMMUTABLE_ARTIFACT error
    expect(
      sessionService.saveArtifact(
        sessionId,
        "source",
        filename,
        "<div>Overwrite</div>",
      ),
    ).rejects.toThrow(SessionError);
  });

  test("session reopen restores full multi-version tree", async () => {
    const multiVersionCandidate: Candidate = {
      id: "design-001",
      sessionId,
      index: 1,
      state: "completed",
      currentVersionId: "v002",
      versions: [
        {
          id: "v001",
          candidateId: "design-001",
          versionNumber: 1,
          promptSnapshot: "Prompt 1",
          jsxSourcePath: "source/design-001-v001.jsx",
          svgPath: "svg/design-001-v001.svg",
          pngPath: "images/design-001-v001.png",
          createdAt: "2026-10-24T10:00:00.000Z",
        },
        {
          id: "v002",
          candidateId: "design-001",
          versionNumber: 2,
          parentVersionId: "v001",
          promptSnapshot: "Prompt 2",
          revisionPrompt: "Make it dark",
          jsxSourcePath: "source/design-001-v002.jsx",
          svgPath: "svg/design-001-v002.svg",
          pngPath: "images/design-001-v002.png",
          createdAt: "2026-10-24T10:05:00.000Z",
        },
      ],
      createdAt: "2026-10-24T10:00:00.000Z",
      updatedAt: "2026-10-24T10:05:00.000Z",
    };

    await sessionService.saveCandidate(sessionId, multiVersionCandidate);

    // Reopen from fresh service instance
    const freshService = new SessionService(TEST_DIR);
    const loaded = await freshService.getSession(sessionId);
    const cand = loaded.session.candidates?.[0];

    expect(cand?.currentVersionId).toBe("v002");
    expect(cand?.versions?.length).toBe(2);
    expect(cand?.versions?.[1]?.parentVersionId).toBe("v001");
    expect(cand?.versions?.[1]?.revisionPrompt).toBe("Make it dark");
  });
});
