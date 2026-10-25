import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CandidateGallery } from "../../src/components/CandidateGallery";
import type { Candidate } from "../../src/domain/candidate";

describe("CandidateGallery", () => {
  const mockCandidates: Candidate[] = [
    {
      id: "c-1",
      sessionId: "sess-1",
      index: 0,
      state: "completed",
      artifacts: { pngPath: "images/c-1.png" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "c-2",
      sessionId: "sess-1",
      index: 1,
      state: "failed",
      errorMessage: "Render timed out",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  test("renders empty state for new session when candidates list is empty", () => {
    const html = renderToStaticMarkup(
      <CandidateGallery
        sessionId="sess-1"
        candidates={[]}
        onSelectCandidate={() => {}}
      />,
    );

    expect(html).toContain("empty-state-new-session");
    expect(html).toContain("No candidates yet");
  });

  test("renders empty state for generating when candidates is empty and isGenerating is true", () => {
    const html = renderToStaticMarkup(
      <CandidateGallery
        sessionId="sess-1"
        candidates={[]}
        isGenerating={true}
        onSelectCandidate={() => {}}
      />,
    );

    expect(html).toContain("empty-state-generating");
    expect(html).toContain("Generating candidates");
  });

  test("renders candidate cards in a grid", () => {
    const html = renderToStaticMarkup(
      <CandidateGallery
        sessionId="sess-1"
        candidates={mockCandidates}
        selectedCandidateId="c-1"
        onSelectCandidate={() => {}}
      />,
    );

    expect(html).toContain("candidate-gallery-grid");
    expect(html).toContain('data-candidate-id="c-1"');
    expect(html).toContain('data-candidate-id="c-2"');
    expect(html).toContain("Candidate #1");
    expect(html).toContain("Candidate #2");
  });

  test("highlights selected candidate card", () => {
    const html = renderToStaticMarkup(
      <CandidateGallery
        sessionId="sess-1"
        candidates={mockCandidates}
        selectedCandidateId="c-2"
        onSelectCandidate={() => {}}
      />,
    );

    expect(html).toContain('class="candidate-card selected state-failed"');
    expect(html).toContain('data-candidate-id="c-2"');
  });

  test("shows warning notice when all finished candidates failed", () => {
    const allFailedCandidates: Candidate[] = [
      {
        id: "c-f1",
        sessionId: "sess-1",
        index: 0,
        state: "failed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const html = renderToStaticMarkup(
      <CandidateGallery
        sessionId="sess-1"
        candidates={allFailedCandidates}
        onSelectCandidate={() => {}}
      />,
    );

    expect(html).toContain("gallery-notice-banner warning");
    expect(html).toContain("None of the candidates completed successfully");
  });

  test("does not show warning notice when at least one candidate succeeded", () => {
    const mixedCandidates: Candidate[] = [
      {
        id: "c-success",
        sessionId: "s-1",
        index: 0,
        state: "completed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "c-fail",
        sessionId: "s-1",
        index: 1,
        state: "failed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const html = renderToStaticMarkup(
      <CandidateGallery
        candidates={mixedCandidates}
        sessionId="s-1"
        selectedCandidateId={undefined}
        onSelectCandidate={() => {}}
      />,
    );

    expect(html).not.toContain("batch-failure-notice");
    expect(html).toContain('data-candidate-id="c-success"');
    expect(html).toContain('data-candidate-id="c-fail"');
  });

  test("passes isRetrying state to targeted candidate card", () => {
    const failedCandidates: Candidate[] = [
      {
        id: "c-retry-1",
        sessionId: "s-1",
        index: 0,
        state: "failed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const html = renderToStaticMarkup(
      <CandidateGallery
        candidates={failedCandidates}
        sessionId="s-1"
        onSelectCandidate={() => {}}
        onRetryCandidate={() => {}}
        retryingCandidateId="c-retry-1"
      />,
    );

    expect(html).toContain('data-testid="retry-button"');
    expect(html).toContain("disabled");
    expect(html).toContain("Retrying...");
  });

  test("selectively disables only the targeted candidate card when retryingCandidateId is specified", () => {
    const candidates: Candidate[] = [
      {
        id: "c-active-retry",
        sessionId: "s-1",
        index: 0,
        label: "Card 1",
        state: "failed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "c-idle-fail",
        sessionId: "s-1",
        index: 1,
        label: "Card 2",
        state: "failed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "c-ready",
        sessionId: "s-1",
        index: 2,
        label: "Card 3",
        state: "completed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const html = renderToStaticMarkup(
      <CandidateGallery
        candidates={candidates}
        sessionId="s-1"
        onSelectCandidate={() => {}}
        onRetryCandidate={() => {}}
        retryingCandidateId="c-active-retry"
      />,
    );

    // Card 1 is retrying
    expect(html).toContain('aria-label="Retrying Card 1"');
    expect(html).toContain("Retrying...");

    // Card 2 is failed but not currently retrying
    expect(html).toContain('aria-label="Retry Card 2"');

    // Card 3 is ready: no retry button
    expect(html).not.toContain('aria-label="Retry Card 3"');
    expect(html).not.toContain('aria-label="Retrying Card 3"');
  });

  test("disables all failed and cancelled retry buttons when global isRetrying is true", () => {
    const candidates: Candidate[] = [
      {
        id: "c-1",
        sessionId: "s-1",
        index: 0,
        label: "Card 1",
        state: "failed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "c-2",
        sessionId: "s-1",
        index: 1,
        label: "Card 2",
        state: "cancelled",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const html = renderToStaticMarkup(
      <CandidateGallery
        candidates={candidates}
        sessionId="s-1"
        onSelectCandidate={() => {}}
        onRetryCandidate={() => {}}
        isRetrying={true}
      />,
    );

    expect(html).toContain('aria-label="Retrying Card 1"');
    expect(html).toContain('aria-label="Retrying Card 2"');
    expect(html).not.toContain('aria-label="Retry Card 1"');
    expect(html).not.toContain('aria-label="Retry Card 2"');
  });
});
