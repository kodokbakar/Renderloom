import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { VersionHistory } from "../../src/components/VersionHistory";
import type { Version } from "../../src/domain/version";

describe("VersionHistory Component", () => {
  const mockVersions: Version[] = [
    {
      id: "v001",
      candidateId: "design-001",
      versionNumber: 1,
      promptSnapshot: "Initial snapshot",
      jsxSourcePath: "source/design-001-v001.jsx",
      svgPath: "svg/design-001-v001.svg",
      pngPath: "images/design-001-v001.png",
      createdAt: "2026-10-24T10:00:00.000Z",
      label: "Initial Swiss Poster",
    },
    {
      id: "v002",
      candidateId: "design-001",
      versionNumber: 2,
      parentVersionId: "v001",
      promptSnapshot: "Revision snapshot",
      revisionPrompt: "Make background dark and title yellow",
      jsxSourcePath: "source/design-001-v002.jsx",
      svgPath: "svg/design-001-v002.svg",
      pngPath: "images/design-001-v002.png",
      createdAt: "2026-10-24T10:05:00.000Z",
      label: "Dark Mode Revision",
    },
  ];

  test("returns null when versions array is empty", () => {
    const html = renderToStaticMarkup(
      <VersionHistory
        sessionId="sess-1"
        versions={[]}
        currentVersionId="v001"
      />,
    );
    expect(html).toBe("");
  });

  test("renders version history timeline with active and restore controls", () => {
    const html = renderToStaticMarkup(
      <VersionHistory
        sessionId="sess-1"
        versions={mockVersions}
        currentVersionId="v002"
        onRestoreVersion={() => {}}
      />,
    );

    expect(html).toContain("Version History");
    expect(html).toContain("2 versions");
    expect(html).toContain("v1");
    expect(html).toContain("v2");
    expect(html).toContain("Active");
    expect(html).toContain("← v001");
    expect(html).toContain("Make background dark and title yellow");
    expect(html).toContain("btn-restore-version");
    expect(html).toContain("Restore");
  });

  test("marks viewing badge when historical version is selected", () => {
    const html = renderToStaticMarkup(
      <VersionHistory
        sessionId="sess-1"
        versions={mockVersions}
        currentVersionId="v002"
        selectedVersionId="v001"
        onRestoreVersion={() => {}}
      />,
    );

    expect(html).toContain("viewing-pill");
    expect(html).toContain("Viewing");
  });
});
