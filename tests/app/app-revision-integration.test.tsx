import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../../src/app/App";
import { PreviewModal } from "../../src/components/PreviewModal";
import type { Candidate } from "../../src/domain/candidate";
import type { FullSession } from "../../src/domain/session";

describe("App & PreviewModal Revision Integration", () => {
  const mockCandidates: Candidate[] = [
    {
      id: "design-001",
      sessionId: "session-rev-1",
      index: 0,
      state: "completed",
      label: "Swiss Modern Poster",
      rationale: "Clean layout",
      currentVersionId: "v002",
      artifacts: {
        sourcePath: "source/design-001-v002.jsx",
        svgPath: "svg/design-001-v002.svg",
        pngPath: "images/design-001-v002.png",
      },
      versions: [
        {
          id: "v001",
          candidateId: "design-001",
          versionNumber: 1,
          promptSnapshot: "Initial snapshot",
          jsxSourcePath: "source/design-001-v001.jsx",
          svgPath: "svg/design-001-v001.svg",
          pngPath: "images/design-001-v001.png",
          createdAt: "2026-10-24T10:00:00.000Z",
          label: "Initial Layout",
        },
        {
          id: "v002",
          candidateId: "design-001",
          versionNumber: 2,
          parentVersionId: "v001",
          promptSnapshot: "Revision snapshot",
          revisionPrompt: "Switch to obsidian background and increase padding",
          jsxSourcePath: "source/design-001-v002.jsx",
          svgPath: "svg/design-001-v002.svg",
          pngPath: "images/design-001-v002.png",
          createdAt: "2026-10-24T10:05:00.000Z",
          label: "Dark Obsidian Variant",
        },
      ],
      createdAt: "2026-10-24T10:00:00.000Z",
      updatedAt: "2026-10-24T10:05:00.000Z",
    },
  ];

  const mockFullSession: FullSession = {
    session: {
      id: "session-rev-1",
      name: "Poster Session",
      slug: "poster-session",
      providerId: "mock-provider",
      modelId: "mock-model",
      styleId: "swiss-international",
      dimensions: { width: 1024, height: 1024 },
      candidates: mockCandidates,
      createdAt: "2026-10-24T10:00:00.000Z",
      updatedAt: "2026-10-24T10:05:00.000Z",
    },
    conversation: {
      sessionId: "session-rev-1",
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "Create swiss poster",
          timestamp: "2026-10-24T10:00:00.000Z",
        },
        {
          id: "msg-2",
          role: "user",
          content: "Switch to obsidian background and increase padding",
          timestamp: "2026-10-24T10:05:00.000Z",
          candidateId: "design-001",
          versionId: "v002",
        },
      ],
      updatedAt: "2026-10-24T10:05:00.000Z",
    },
    promptSnapshot: "Snapshot",
    generationConfig: {
      providerId: "mock-provider",
      modelId: "mock-model",
      styleId: "swiss-international",
      candidateCount: 1,
      width: 1024,
      height: 1024,
      outputFormat: "png",
      createdAt: "2026-10-24T10:00:00.000Z",
    },
    artifacts: {
      images: ["design-001-v001.png", "design-001-v002.png"],
      source: ["design-001-v001.jsx", "design-001-v002.jsx"],
      svg: ["design-001-v001.svg", "design-001-v002.svg"],
      assets: [],
    },
  };

  test("App renders workspace with multi-version candidate", () => {
    const html = renderToStaticMarkup(
      <App
        initialFullSession={mockFullSession}
        initialSelectedCandidateId="design-001"
      />,
    );

    expect(html).toContain("studio-container");
    expect(html).toContain("Swiss Modern Poster");
  });

  test("PreviewModal renders revision input and version history sidebar", () => {
    const html = renderToStaticMarkup(
      <PreviewModal
        isOpen={true}
        sessionId="session-rev-1"
        candidate={mockCandidates[0] ?? null}
        session={mockFullSession.session}
        onClose={() => {}}
      />,
    );

    expect(html).toContain("Design Revision");
    expect(html).toContain("Parent: v002");
    expect(html).toContain("Version History");
    expect(html).toContain("2 versions");
    expect(html).toContain("v1");
    expect(html).toContain("v2");
    expect(html).toContain("Active");
  });

  test("PreviewModal displays sanitized revision error alert when candidate has lastRevisionError", () => {
    const candidateWithError: Candidate = {
      ...(mockCandidates[0] as Candidate),
      lastRevisionError: {
        message: "AST syntax error: Unsupported node type 'ImportDeclaration'",
        code: "VALIDATION_FAILED",
        parentVersionId: "v002",
        attemptedAt: "2026-10-24T10:10:00.000Z",
      },
    };

    const html = renderToStaticMarkup(
      <PreviewModal
        isOpen={true}
        sessionId="session-rev-1"
        candidate={candidateWithError}
        session={mockFullSession.session}
        onClose={() => {}}
      />,
    );

    expect(html).toContain("revision-error-alert");
    expect(html).toContain("Revision Failed");
    expect(html).toContain("VALIDATION_FAILED");
    expect(html).toContain(
      "AST syntax error: Unsupported node type &#x27;ImportDeclaration&#x27;",
    );
    expect(html).toContain("Active version remains usable");
  });
});
