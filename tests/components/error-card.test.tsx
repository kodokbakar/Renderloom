import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ErrorCard } from "../../src/components/ErrorCard";
import type { Candidate } from "../../src/domain/candidate";

describe("ErrorCard", () => {
  const baseCandidate: Candidate = {
    id: "cand-err-1",
    sessionId: "sess-err",
    index: 0,
    state: "completed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  test("renders null for non-failed and non-cancelled candidate states", () => {
    const completedHtml = renderToStaticMarkup(
      <ErrorCard candidate={{ ...baseCandidate, state: "completed" }} />,
    );
    expect(completedHtml).toBe("");

    const generatingHtml = renderToStaticMarkup(
      <ErrorCard candidate={{ ...baseCandidate, state: "generating" }} />,
    );
    expect(generatingHtml).toBe("");
  });

  test("renders failed candidate with sanitized error and error code badge", () => {
    const failedCand: Candidate = {
      ...baseCandidate,
      state: "failed",
      errorCode: "DANGEROUS_CODE_DETECTED",
      errorMessage:
        "Validation error: /home/dokbakar/eval.jsx with sk-ant-1234567890abcdef",
    };

    const html = renderToStaticMarkup(
      <ErrorCard candidate={failedCand} onRetry={() => {}} />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("DANGEROUS_CODE_DETECTED");
    expect(html).toContain("Generation Error");
    expect(html).toContain("[FILE_PATH]");
    expect(html).toContain("[REDACTED_API_KEY]");
    expect(html).not.toContain("/home/dokbakar/eval.jsx");
    expect(html).not.toContain("sk-ant-1234567890abcdef");
    expect(html).toContain("Retry Candidate");
  });

  test("renders cancelled candidate with cancellation message", () => {
    const cancelledCand: Candidate = {
      ...baseCandidate,
      state: "cancelled",
    };

    const html = renderToStaticMarkup(<ErrorCard candidate={cancelledCand} />);

    expect(html).toContain("Candidate Cancelled");
    expect(html).toContain("Generation was cancelled by the user.");
  });
});
