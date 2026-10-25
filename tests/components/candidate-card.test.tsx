import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CandidateCard } from "../../src/components/CandidateCard";
import type { Candidate } from "../../src/domain/candidate";

describe("CandidateCard", () => {
  const baseCandidate: Candidate = {
    id: "c-123",
    sessionId: "sess-abc",
    index: 0,
    state: "completed",
    label: "Candidate Variant A",
    rationale: "Clean geometric layout with modern contrast",
    artifacts: {
      pngPath: "images/c-123.png",
      svgPath: "svg/c-123.svg",
      sourcePath: "source/c-123.tsx",
    },
    timings: {
      durationMs: 1500,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  test("renders completed candidate with image thumbnail and duration", () => {
    const html = renderToStaticMarkup(
      <CandidateCard
        candidate={baseCandidate}
        sessionId="sess-abc"
        isSelected={false}
      />,
    );

    expect(html).toContain("Candidate Variant A");
    expect(html).toContain("1.5s");
    expect(html).toContain("/api/sessions/sess-abc/artifacts/images/c-123.png");
    expect(html).toContain("Clean geometric layout with modern contrast");
    expect(html).toContain('data-candidate-state="completed"');
    expect(html).toContain('aria-pressed="false"');
  });

  test("renders selected candidate with selected class and aria-pressed true", () => {
    const html = renderToStaticMarkup(
      <CandidateCard
        candidate={baseCandidate}
        sessionId="sess-abc"
        isSelected={true}
      />,
    );

    expect(html).toContain("selected");
    expect(html).toContain('aria-pressed="true"');
  });

  test("renders failed candidate with sanitized error snippet and retry action", () => {
    const failedCandidate: Candidate = {
      ...baseCandidate,
      id: "c-fail",
      state: "failed",
      errorMessage:
        "AST validation failed: sk-secret12345678901234 forbidden identifier 'eval'",
    };

    const html = renderToStaticMarkup(
      <CandidateCard
        candidate={failedCandidate}
        sessionId="sess-abc"
        onRetry={() => {}}
      />,
    );

    expect(html).toContain(
      "AST validation failed: [REDACTED_API_KEY] forbidden identifier &#x27;eval&#x27;",
    );
    expect(html).not.toContain("sk-secret12345678901234");
    expect(html).toContain("btn-card-retry");
    expect(html).toContain('data-testid="retry-button"');
    expect(html).toContain("Retry");
  });

  test("renders retry button with loading state when isRetrying is true", () => {
    const failedCandidate: Candidate = {
      ...baseCandidate,
      id: "c-fail-retrying",
      state: "failed",
      errorMessage: "Render timeout",
    };

    const html = renderToStaticMarkup(
      <CandidateCard
        candidate={failedCandidate}
        sessionId="sess-abc"
        onRetry={() => {}}
        isRetrying={true}
      />,
    );

    expect(html).toContain('data-testid="retry-button"');
    expect(html).toContain("disabled");
    expect(html).toContain("Retrying...");
    expect(html).toContain("spin");
  });

  test("renders in-progress states with progress label", () => {
    const validatingCand: Candidate = {
      ...baseCandidate,
      state: "validating",
    };
    const html = renderToStaticMarkup(
      <CandidateCard candidate={validatingCand} sessionId="sess-abc" />,
    );

    expect(html).toContain("Validating AST...");
  });

  test("falls back to candidate index label if label is omitted", () => {
    const noLabelCand: Candidate = {
      ...baseCandidate,
      label: undefined,
      index: 2,
    };
    const html = renderToStaticMarkup(
      <CandidateCard candidate={noLabelCand} sessionId="sess-abc" />,
    );

    expect(html).toContain("Candidate #3");
  });

  test("renders cancelled candidate with cancelled message and retry action", () => {
    const cancelledCand: Candidate = {
      ...baseCandidate,
      id: "c-cancel",
      state: "cancelled",
    };
    const html = renderToStaticMarkup(
      <CandidateCard
        candidate={cancelledCand}
        sessionId="sess-abc"
        onRetry={() => {}}
      />,
    );

    expect(html).toContain('data-candidate-state="cancelled"');
    expect(html).toContain("Generation cancelled");
    expect(html).toContain("btn-card-retry");
    expect(html).toContain('data-testid="retry-button"');
    expect(html).toContain("Retry");
    expect(html).not.toContain("disabled");
  });

  test("renders retry button in loading state for cancelled candidate when isRetrying is true", () => {
    const cancelledCand: Candidate = {
      ...baseCandidate,
      id: "c-cancel-retrying",
      label: "Hero Slide",
      state: "cancelled",
    };
    const html = renderToStaticMarkup(
      <CandidateCard
        candidate={cancelledCand}
        sessionId="sess-abc"
        onRetry={() => {}}
        isRetrying={true}
      />,
    );

    expect(html).toContain('data-testid="retry-button"');
    expect(html).toContain("disabled");
    expect(html).toContain("Retrying...");
    expect(html).toContain("spin");
    expect(html).toContain('aria-label="Retrying Hero Slide"');
  });

  test("does not render retry button for completed or validating candidate even if isRetrying is true", () => {
    const completedCand: Candidate = {
      ...baseCandidate,
      state: "completed",
      artifacts: {
        sourcePath: "/path/to.jsx",
        svgPath: "/path/to.svg",
        pngPath: "/path/to.png",
      },
    };
    const html = renderToStaticMarkup(
      <CandidateCard
        candidate={completedCand}
        sessionId="sess-abc"
        onRetry={() => {}}
        isRetrying={true}
      />,
    );

    expect(html).not.toContain('data-testid="retry-button"');
    expect(html).not.toContain("btn-card-retry");
  });

  test("renders fallback when completed candidate is missing image artifacts", () => {
    const noArtifactsCand: Candidate = {
      ...baseCandidate,
      artifacts: undefined,
    };
    const html = renderToStaticMarkup(
      <CandidateCard candidate={noArtifactsCand} sessionId="sess-abc" />,
    );

    expect(html).toContain("Artifact unavailable");
  });

  test("renders all in-progress states with appropriate progress messages", () => {
    const states = [
      { state: "queued" as const, expected: "Queued..." },
      { state: "generating" as const, expected: "Generating code..." },
      { state: "rendering" as const, expected: "Rendering PNG..." },
    ];

    for (const { state, expected } of states) {
      const cand: Candidate = { ...baseCandidate, state };
      const html = renderToStaticMarkup(
        <CandidateCard candidate={cand} sessionId="sess-abc" />,
      );
      expect(html).toContain(expected);
    }
  });

  test("handles extremely long label and rationale without error", () => {
    const longLabel = "Extreme Long Candidate Label ".repeat(10).trim();
    const longRationale = "Deep rationale explaining design details "
      .repeat(20)
      .trim();
    const longCand: Candidate = {
      ...baseCandidate,
      label: longLabel,
      rationale: longRationale,
    };

    const html = renderToStaticMarkup(
      <CandidateCard candidate={longCand} sessionId="sess-abc" />,
    );

    expect(html).toContain(longLabel);
    expect(html).toContain(longRationale);
  });
});
