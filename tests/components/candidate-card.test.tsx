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
    expect(html).toContain("Retry");
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
});
