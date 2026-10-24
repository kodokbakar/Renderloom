import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { Candidate } from "../../src/domain/candidate";
import type { BatchSummary } from "../../src/domain/session";
import { SessionService } from "../../src/sessions/service";

const TEST_DIR = path.join(
  process.cwd(),
  `tmp-test-candidate-persistence-${Date.now()}`,
);

describe("Session Candidate Persistence", () => {
  let service: SessionService;

  beforeEach(async () => {
    service = new SessionService(TEST_DIR);
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  test("saves and updates candidates on session", async () => {
    const session = await service.createSession({
      name: "Persistence Test",
      providerId: "openai",
      modelId: "gpt-4o",
      styleId: "tech-spec",
      width: 1024,
      height: 1024,
    });

    const c1: Candidate = {
      id: "design-001",
      sessionId: session.id,
      index: 1,
      state: "completed",
      label: "Initial Design",
      rationale: "Clean layout",
      currentVersionId: "v001",
      artifacts: {
        sourcePath: "source/design-001-v001.jsx",
        svgPath: "svg/design-001-v001.svg",
        pngPath: "images/design-001-v001.png",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedSession = await service.saveCandidate(session.id, c1);
    expect(updatedSession.candidates?.length).toBe(1);
    expect(updatedSession.candidates?.[0]?.id).toBe("design-001");
    expect(updatedSession.candidates?.[0]?.label).toBe("Initial Design");

    // Update the same candidate
    const c1Updated: Candidate = {
      ...c1,
      label: "Updated Label",
      updatedAt: new Date().toISOString(),
    };

    const sessionAfterUpdate = await service.saveCandidate(
      session.id,
      c1Updated,
    );
    expect(sessionAfterUpdate.candidates?.length).toBe(1);
    expect(sessionAfterUpdate.candidates?.[0]?.label).toBe("Updated Label");

    // Add candidate 2
    const c2: Candidate = {
      id: "design-002",
      sessionId: session.id,
      index: 2,
      state: "failed",
      errorMessage: "Render failed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const sessionWithTwo = await service.saveCandidate(session.id, c2);
    expect(sessionWithTwo.candidates?.length).toBe(2);

    // Read back via getCandidates
    const loadedCandidates = await service.getCandidates(session.id);
    expect(loadedCandidates.length).toBe(2);
    expect(loadedCandidates[0]?.id).toBe("design-001");
    expect(loadedCandidates[1]?.id).toBe("design-002");
    expect(loadedCandidates[1]?.state).toBe("failed");
  });

  test("records batch summary on session", async () => {
    const session = await service.createSession({
      name: "Batch Summary Test",
      providerId: "openai",
      modelId: "gpt-4o",
      styleId: "tech-spec",
      width: 1024,
      height: 1024,
    });

    const summary: BatchSummary = {
      batchId: "batch-123",
      status: "partial_success",
      totalCandidates: 2,
      successfulCandidates: 1,
      failedCandidates: 1,
      cancelledCandidates: 0,
      completedAt: new Date().toISOString(),
    };

    const updated = await service.recordBatchSummary(session.id, summary);
    expect(updated.activeBatchId).toBe("batch-123");
    expect(updated.lastBatchStatus).toBe("partial_success");
    expect(updated.lastBatchSummary?.successfulCandidates).toBe(1);

    // Read full session
    const full = await service.getSession(session.id);
    expect(full.session.lastBatchStatus).toBe("partial_success");
  });
});
