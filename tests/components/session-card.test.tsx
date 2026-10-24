import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionCard } from "../../src/components/SessionCard";
import type { SessionSummary } from "../../src/domain/session";

describe("SessionCard", () => {
  const mockSession: SessionSummary = {
    id: "session-101",
    name: "Architectural Poster",
    slug: "architectural-poster",
    providerId: "anthropic",
    modelId: "claude-3-5-sonnet",
    styleId: "tech-minimal",
    dimensions: { width: 1024, height: 1024 },
    candidateCount: 4,
    createdAt: "2026-10-24T12:00:00.000Z",
    updatedAt: "2026-10-24T12:30:00.000Z",
  };

  test("renders session metadata, slug, dimensions, and candidate count", () => {
    const html = renderToStaticMarkup(
      <SessionCard
        session={mockSession}
        onOpen={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(html).toContain("Architectural Poster");
    expect(html).toContain("architectural-poster");
    expect(html).toContain("tech-minimal");
    expect(html).toContain("1024×1024");
    expect(html).toContain("anthropic/claude-3-5-sonnet");
    expect(html).toContain("4 candidates");
    expect(html).toContain('data-testid="open-studio-btn"');
    expect(html).toContain('data-testid="delete-session-btn"');
  });

  test("handles single candidate count pluralization", () => {
    const singleSession: SessionSummary = {
      ...mockSession,
      candidateCount: 1,
    };
    const html = renderToStaticMarkup(
      <SessionCard
        session={singleSession}
        onOpen={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(html).toContain("1 candidate");
  });
});
