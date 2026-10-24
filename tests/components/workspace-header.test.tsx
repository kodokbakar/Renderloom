import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BatchProgressIndicator } from "../../src/components/BatchProgressIndicator";
import { GenerationSettingsBar } from "../../src/components/GenerationSettingsBar";
import { WorkspaceHeader } from "../../src/components/WorkspaceHeader";
import type { Candidate } from "../../src/domain/candidate";
import type { Session, SessionSummary } from "../../src/domain/session";

describe("Workspace Header & Controls", () => {
  const mockSession: Session = {
    id: "sess-1",
    name: "Summer Campaign Icons",
    slug: "summer-campaign-icons",
    providerId: "openai",
    modelId: "gpt-4o",
    styleId: "tech-minimal",
    dimensions: { width: 1024, height: 1024 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockSummaries: SessionSummary[] = [
    {
      id: "sess-1",
      name: "Summer Campaign Icons",
      slug: "summer-campaign-icons",
      providerId: "openai",
      modelId: "gpt-4o",
      styleId: "tech-minimal",
      dimensions: { width: 1024, height: 1024 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "sess-2",
      name: "Winter Logo Batch",
      slug: "winter-logo-batch",
      providerId: "anthropic",
      modelId: "claude-3-5-sonnet",
      styleId: "modern-clean",
      dimensions: { width: 800, height: 800 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  test("WorkspaceHeader renders brand, session name, slug, and session selector", () => {
    const html = renderToStaticMarkup(
      <WorkspaceHeader
        session={mockSession}
        sessions={mockSummaries}
        onSelectSession={() => {}}
        promptSnapshot="A vibrant set of summer icons"
      />,
    );

    expect(html).toContain("Renderloom");
    expect(html).toContain("Summer Campaign Icons");
    expect(html).toContain("summer-campaign-icons");
    expect(html).toContain('<select id="session-select"');
    expect(html).toContain("Winter Logo Batch");
    expect(html).toContain("View Prompt");
  });

  test("GenerationSettingsBar renders provider, model, style, dimensions, and candidate count", () => {
    const html = renderToStaticMarkup(
      <GenerationSettingsBar
        session={mockSession}
        generationConfig={{
          providerId: "openai",
          modelId: "gpt-4o",
          styleId: "tech-minimal",
          candidateCount: 4,
          width: 1024,
          height: 1024,
          outputFormat: "png",
          createdAt: new Date().toISOString(),
        }}
      />,
    );

    expect(html).toContain("openai");
    expect(html).toContain("gpt-4o");
    expect(html).toContain("tech-minimal");
    expect(html).toContain("1024 × 1024");
    expect(html).toContain("4");
  });

  test("BatchProgressIndicator renders running progress, percentage, and cancel action", () => {
    const mockCandidates: Candidate[] = [
      {
        id: "c-1",
        sessionId: "sess-1",
        index: 0,
        state: "completed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "c-2",
        sessionId: "sess-1",
        index: 1,
        state: "generating",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const html = renderToStaticMarkup(
      <BatchProgressIndicator
        batchId="batch-123"
        status="running"
        candidates={mockCandidates}
        onCancelBatch={() => {}}
      />,
    );

    expect(html).toContain("Generating Batch (1 of 2 complete)");
    expect(html).toContain("50%");
    expect(html).toContain("Cancel Batch");
  });

  test("WorkspaceHeader renders navigation button and API keys button when handlers provided", () => {
    const html = renderToStaticMarkup(
      <WorkspaceHeader
        session={mockSession}
        onNavigateDashboard={() => {}}
        onOpenApiKeys={() => {}}
      />,
    );

    expect(html).toContain('data-testid="nav-dashboard-btn"');
    expect(html).toContain("← Dashboard");
    expect(html).toContain('data-testid="header-api-keys-btn"');
    expect(html).toContain("API Keys");
  });
});
