import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusBadge } from "../../src/components/StatusBadge";
import type { CandidateState } from "../../src/domain/candidate";

describe("StatusBadge", () => {
  const states: CandidateState[] = [
    "queued",
    "generating",
    "validating",
    "rendering",
    "completed",
    "failed",
    "cancelled",
  ];

  for (const state of states) {
    test(`renders badge for state: ${state}`, () => {
      const html = renderToStaticMarkup(<StatusBadge state={state} />);
      expect(html).toContain(`data-state="${state}"`);
      expect(html).toContain(`badge-${state}`);
      // First letter capitalized label check
      const capitalized = state.charAt(0).toUpperCase() + state.slice(1);
      expect(html).toContain(capitalized);
    });
  }

  test("supports hiding icon", () => {
    const withIcon = renderToStaticMarkup(
      <StatusBadge state="completed" showIcon={true} />,
    );
    const withoutIcon = renderToStaticMarkup(
      <StatusBadge state="completed" showIcon={false} />,
    );
    expect(withIcon).toContain("<svg");
    expect(withoutIcon).not.toContain("<svg");
  });
});
