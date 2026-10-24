import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../../src/app/App";
import type { Candidate } from "../../src/domain/candidate";
import type { FullSession, SessionSummary } from "../../src/domain/session";

describe("App Studio Workspace Integration", () => {
  const mockCandidates: Candidate[] = [
    {
      id: "cand-1",
      sessionId: "session-alpha",
      index: 0,
      state: "completed",
      label: "Variant A - Modern",
      rationale: "Clean vector shapes with balanced spacing",
      currentVersionId: "v1",
      artifacts: {
        pngPath: "images/cand-1.png",
        svgPath: "svg/cand-1.svg",
        sourcePath: "source/cand-1.tsx",
      },
      timings: {
        durationMs: 1800,
        generationStartedAt: "2026-10-24T10:00:00.000Z",
        generationEndedAt: "2026-10-24T10:00:01.000Z",
        validationStartedAt: "2026-10-24T10:00:01.000Z",
        validationEndedAt: "2026-10-24T10:00:01.200Z",
        renderingStartedAt: "2026-10-24T10:00:01.200Z",
        renderingEndedAt: "2026-10-24T10:00:01.800Z",
      },
      createdAt: "2026-10-24T10:00:00.000Z",
      updatedAt: "2026-10-24T10:00:01.800Z",
    },
    {
      id: "cand-2",
      sessionId: "session-alpha",
      index: 1,
      state: "failed",
      label: "Variant B - Dynamic",
      errorMessage:
        "AST validation failed: sk-secret12345678901234 forbidden identifier 'eval'",
      errorCode: "VALIDATION_FAILED",
      timings: {
        durationMs: 650,
      },
      createdAt: "2026-10-24T10:00:00.000Z",
      updatedAt: "2026-10-24T10:00:00.650Z",
    },
  ];

  const mockFullSession: FullSession = {
    session: {
      id: "session-alpha",
      name: "Brand Logo Exploration",
      slug: "brand-logo-exploration",
      providerId: "anthropic",
      modelId: "claude-3-5-sonnet",
      styleId: "tech-minimal",
      dimensions: { width: 1024, height: 1024 },
      activeBatchId: "batch-77",
      lastBatchStatus: "partial_success",
      candidates: mockCandidates,
      createdAt: "2026-10-24T10:00:00.000Z",
      updatedAt: "2026-10-24T10:00:02.000Z",
    },
    conversation: {
      sessionId: "session-alpha",
      messages: [],
      updatedAt: "2026-10-24T10:00:00.000Z",
    },
    promptSnapshot:
      "Design a high-tech minimal logo icon for Renderloom AI studio",
    generationConfig: {
      providerId: "anthropic",
      modelId: "claude-3-5-sonnet",
      styleId: "tech-minimal",
      candidateCount: 2,
      width: 1024,
      height: 1024,
      outputFormat: "png",
      createdAt: "2026-10-24T10:00:00.000Z",
    },
    artifacts: {
      images: ["cand-1.png"],
      source: ["cand-1.tsx"],
      svg: ["cand-1.svg"],
      assets: [],
    },
  };

  const mockSessions: SessionSummary[] = [
    {
      id: "session-alpha",
      name: "Brand Logo Exploration",
      slug: "brand-logo-exploration",
      providerId: "anthropic",
      modelId: "claude-3-5-sonnet",
      styleId: "tech-minimal",
      dimensions: { width: 1024, height: 1024 },
      candidateCount: 2,
      createdAt: "2026-10-24T10:00:00.000Z",
      updatedAt: "2026-10-24T10:00:02.000Z",
    },
  ];

  test("renders studio workspace with header, settings, progress, and gallery", () => {
    const html = renderToStaticMarkup(
      <App
        initialFullSession={mockFullSession}
        initialSessions={mockSessions}
        initialSelectedCandidateId="cand-1"
      />,
    );

    // Header checks
    expect(html).toContain("Renderloom");
    expect(html).toContain("Brand Logo Exploration");
    expect(html).toContain("brand-logo-exploration");
    expect(html).toContain("View Prompt");

    // Studio controls
    expect(html).toContain("studio-controls");
    expect(html).toContain("anthropic");
    expect(html).toContain("claude-3-5-sonnet");
    // Batch progress indicator
    expect(html).toContain("Partial Success (1 completed, 1 failed)");

    // Candidate gallery items
    expect(html).toContain('data-candidate-id="cand-1"');
    expect(html).toContain('data-candidate-id="cand-2"');
    expect(html).toContain("Variant A - Modern");
    expect(html).toContain("Variant B - Dynamic");
  });

  test("completed candidate displays image artifact thumbnail and inspect trigger", () => {
    const html = renderToStaticMarkup(
      <App
        initialFullSession={mockFullSession}
        initialSessions={mockSessions}
        initialSelectedCandidateId="cand-1"
      />,
    );

    expect(html).toContain(
      "/api/sessions/session-alpha/artifacts/images/cand-1.png",
    );
    expect(html).toContain('aria-label="Inspect Variant A - Modern"');
  });

  test("failed candidate card renders sanitized error without credential leaks", () => {
    const html = renderToStaticMarkup(
      <App
        initialFullSession={mockFullSession}
        initialSessions={mockSessions}
        initialSelectedCandidateId="cand-1"
      />,
    );

    expect(html).toContain("[REDACTED_API_KEY]");
    expect(html).not.toContain("sk-secret12345678901234");
  });

  test("renders empty state when session has no candidates", () => {
    const emptySession: FullSession = {
      ...mockFullSession,
      session: {
        ...mockFullSession.session,
        candidates: [],
        lastBatchStatus: undefined,
      },
    };

    const html = renderToStaticMarkup(
      <App initialFullSession={emptySession} initialSessions={mockSessions} />,
    );

    expect(html).toContain("empty-state-new-session");
    expect(html).toContain("No candidates yet");
  });

  test("renders generating empty state when candidates are empty but generation is running", () => {
    const runningSession: FullSession = {
      ...mockFullSession,
      session: {
        ...mockFullSession.session,
        candidates: [],
        lastBatchStatus: "running",
      },
    };

    const html = renderToStaticMarkup(
      <App
        initialFullSession={runningSession}
        initialSessions={mockSessions}
      />,
    );

    expect(html).toContain("empty-state-generating");
    expect(html).toContain("Generating candidates");
  });

  test("candidate preview and version identity correspond to the exact selected version", () => {
    const multiVersionSession: FullSession = {
      ...mockFullSession,
      session: {
        ...mockFullSession.session,
        candidates: [
          {
            id: "cand-v1",
            sessionId: "session-alpha",
            index: 0,
            state: "completed",
            currentVersionId: "cand-v1-ver-1",
            label: "Candidate Version 1",
            artifacts: {
              pngPath: "images/cand-v1-ver-1.png",
              sourcePath: "source/cand-v1-ver-1.tsx",
              svgPath: "svg/cand-v1-ver-1.svg",
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "cand-v2",
            sessionId: "session-alpha",
            index: 1,
            state: "completed",
            currentVersionId: "cand-v2-ver-2",
            label: "Candidate Version 2",
            artifacts: {
              pngPath: "images/cand-v2-ver-2.png",
              sourcePath: "source/cand-v2-ver-2.tsx",
              svgPath: "svg/cand-v2-ver-2.svg",
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    };

    // 1. Initial selection: cand-v1
    const htmlV1 = renderToStaticMarkup(
      <App
        initialFullSession={multiVersionSession}
        initialSessions={mockSessions}
        initialSelectedCandidateId="cand-v1"
      />,
    );

    expect(htmlV1).toContain(
      "/api/sessions/session-alpha/artifacts/images/cand-v1-ver-1.png",
    );
    expect(htmlV1).toContain("Candidate Version 1");

    // 2. Selection: cand-v2
    const htmlV2 = renderToStaticMarkup(
      <App
        initialFullSession={multiVersionSession}
        initialSessions={mockSessions}
        initialSelectedCandidateId="cand-v2"
      />,
    );

    expect(htmlV2).toContain(
      "/api/sessions/session-alpha/artifacts/images/cand-v2-ver-2.png",
    );
    expect(htmlV2).toContain("Candidate Version 2");
  });

  test("renders cancelled candidate properly alongside completed candidates", () => {
    const sessionWithCancelled: FullSession = {
      ...mockFullSession,
      session: {
        ...mockFullSession.session,
        candidates: [
          ...mockCandidates,
          {
            id: "cand-3",
            sessionId: "session-alpha",
            index: 2,
            state: "cancelled",
            label: "Variant C - Cancelled",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    };

    const html = renderToStaticMarkup(
      <App
        initialFullSession={sessionWithCancelled}
        initialSessions={mockSessions}
        initialSelectedCandidateId="cand-3"
      />,
    );

    expect(html).toContain('data-candidate-id="cand-3"');
    expect(html).toContain("Variant C - Cancelled");
    expect(html).toContain("Generation cancelled");
  });
});
