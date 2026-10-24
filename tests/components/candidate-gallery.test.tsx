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
});
