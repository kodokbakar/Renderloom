import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MetadataViewer } from "../../src/components/MetadataViewer";
import type { Candidate } from "../../src/domain/candidate";
import type { Session } from "../../src/domain/session";

describe("MetadataViewer", () => {
  const mockCandidate: Candidate = {
    id: "cand-42",
    sessionId: "sess-99",
    index: 0,
    state: "completed",
    currentVersionId: "cand-42-v1",
    label: "Modern Hero Card",
    rationale: "Optimized for visual hierarchy",
    retries: 1,
    timings: {
      durationMs: 2500,
      generationStartedAt: "2026-10-24T12:00:00.000Z",
      generationEndedAt: "2026-10-24T12:00:01.200Z",
      validationStartedAt: "2026-10-24T12:00:01.200Z",
      validationEndedAt: "2026-10-24T12:00:01.400Z",
      renderingStartedAt: "2026-10-24T12:00:01.400Z",
      renderingEndedAt: "2026-10-24T12:00:02.500Z",
    },
    createdAt: "2026-10-24T12:00:00.000Z",
    updatedAt: "2026-10-24T12:00:02.500Z",
  };

  const mockSession: Session = {
    id: "sess-99",
    name: "Hero Session",
    slug: "hero-session",
    providerId: "mock-provider",
    modelId: "mock-model",
    styleId: "tech-minimal",
    dimensions: {
      width: 1200,
      height: 630,
    },
    createdAt: "2026-10-24T12:00:00.000Z",
    updatedAt: "2026-10-24T12:00:00.000Z",
  };

  test("renders version, candidate ID, label, and rationale", () => {
    const html = renderToStaticMarkup(
      <MetadataViewer candidate={mockCandidate} session={mockSession} />,
    );

    expect(html).toContain("cand-42-v1");
    expect(html).toContain("cand-42");
    expect(html).toContain("Modern Hero Card");
    expect(html).toContain("Optimized for visual hierarchy");
  });

  test("renders session provider, model, style, and dimensions", () => {
    const html = renderToStaticMarkup(
      <MetadataViewer candidate={mockCandidate} session={mockSession} />,
    );

    expect(html).toContain("mock-provider");
    expect(html).toContain("mock-model");
    expect(html).toContain("tech-minimal");
    expect(html).toContain("1200 × 630 px");
  });

  test("renders total duration and phase timings breakdown", () => {
    const html = renderToStaticMarkup(
      <MetadataViewer candidate={mockCandidate} session={mockSession} />,
    );

    expect(html).toContain("2.5s"); // Total duration
    expect(html).toContain("1.2s"); // Code generation duration (1200ms)
    expect(html).toContain("200ms"); // AST validation duration (200ms)
    expect(html).toContain("1.1s"); // PNG rendering duration (1100ms)
    expect(html).toContain("<dt>Retries</dt><dd>1</dd>");
  });

  test("handles candidate with missing timings, session, label, and rationale gracefully", () => {
    const minimalCandidate: Candidate = {
      id: "cand-min",
      sessionId: "sess-99",
      index: 1,
      state: "queued",
      createdAt: "2026-10-24T12:00:00.000Z",
      updatedAt: "2026-10-24T12:00:00.000Z",
    };

    const html = renderToStaticMarkup(
      <MetadataViewer candidate={minimalCandidate} session={undefined} />,
    );

    expect(html).toContain("cand-min");
    expect(html).toContain("v1");
    expect(html).toContain("—"); // Unspecified duration
    expect(html).not.toContain("Optimized for visual hierarchy");
  });
});
