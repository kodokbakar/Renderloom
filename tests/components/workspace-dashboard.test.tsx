import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceDashboard } from "../../src/components/WorkspaceDashboard";
import type { SessionSummary } from "../../src/domain/session";

describe("WorkspaceDashboard", () => {
  const mockSessions: SessionSummary[] = [
    {
      id: "sess-1",
      name: "Geometric Brand Identity",
      slug: "geometric-brand-identity",
      providerId: "anthropic",
      modelId: "claude-3-5-sonnet",
      styleId: "tech-minimal",
      dimensions: { width: 1024, height: 1024 },
      candidateCount: 4,
      createdAt: "2026-10-24T10:00:00.000Z",
      updatedAt: "2026-10-24T11:00:00.000Z",
    },
    {
      id: "sess-2",
      name: "Dashboard Analytics UI",
      slug: "dashboard-analytics-ui",
      providerId: "openai",
      modelId: "gpt-4o",
      styleId: "modern-clean",
      dimensions: { width: 1920, height: 1080 },
      candidateCount: 2,
      createdAt: "2026-10-24T12:00:00.000Z",
      updatedAt: "2026-10-24T13:00:00.000Z",
    },
  ];

  test("renders metrics row, action buttons, and session grid", () => {
    const html = renderToStaticMarkup(
      <WorkspaceDashboard
        sessions={mockSessions}
        onOpenSession={() => {}}
        onNewSession={() => {}}
        onOpenApiKeys={() => {}}
        onDeleteSession={() => {}}
      />,
    );

    expect(html).toContain("Renderloom");
    expect(html).toContain("Workspace Dashboard");
    expect(html).toContain('data-testid="open-api-keys-btn"');
    expect(html).toContain('data-testid="new-session-btn"');
    // Metrics
    expect(html).toContain("Total Sessions");
    expect(html).toContain("2"); // total sessions
    expect(html).toContain("Candidates Drafted");
    expect(html).toContain("6"); // total candidates (4 + 2)
    expect(html).toContain("Active Styles");
    // Filter controls
    expect(html).toContain('data-testid="session-search-input"');
    expect(html).toContain('data-testid="style-filter-select"');
    // Sessions
    expect(html).toContain("Geometric Brand Identity");
    expect(html).toContain("Dashboard Analytics UI");
  });

  test("renders empty state when session list is empty", () => {
    const html = renderToStaticMarkup(
      <WorkspaceDashboard
        sessions={[]}
        onOpenSession={() => {}}
        onNewSession={() => {}}
        onOpenApiKeys={() => {}}
        onDeleteSession={() => {}}
      />,
    );

    expect(html).toContain("No sessions yet");
    expect(html).toContain('data-testid="dashboard-empty-state"');
  });

  test("renders loading indicator when isLoading is true", () => {
    const html = renderToStaticMarkup(
      <WorkspaceDashboard
        sessions={[]}
        isLoading={true}
        onOpenSession={() => {}}
        onNewSession={() => {}}
        onOpenApiKeys={() => {}}
        onDeleteSession={() => {}}
      />,
    );

    expect(html).toContain('data-testid="dashboard-loading"');
    expect(html).toContain("Loading sessions...");
  });
});
