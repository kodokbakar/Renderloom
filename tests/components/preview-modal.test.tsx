import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PreviewModal } from "../../src/components/PreviewModal";
import type { Candidate } from "../../src/domain/candidate";
import type { Session } from "../../src/domain/session";

describe("PreviewModal", () => {
  const mockCandidate: Candidate = {
    id: "cand-1",
    sessionId: "sess-1",
    index: 0,
    state: "completed",
    label: "Candidate Variant 1",
    artifacts: {
      pngPath: "images/cand-1.png",
      svgPath: "svg/cand-1.svg",
      sourcePath: "source/cand-1.tsx",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockSession: Session = {
    id: "sess-1",
    name: "Design Batch",
    slug: "design-batch",
    providerId: "mock-provider",
    modelId: "mock-model",
    styleId: "modern-clean",
    dimensions: { width: 800, height: 800 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  test("renders nothing when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <PreviewModal
        isOpen={false}
        sessionId="sess-1"
        candidate={mockCandidate}
        onClose={() => {}}
      />,
    );

    expect(html).toBe("");
  });

  test("renders modal with header, tabs, image preview, and side panel", () => {
    const html = renderToStaticMarkup(
      <PreviewModal
        isOpen={true}
        sessionId="sess-1"
        candidate={mockCandidate}
        session={mockSession}
        onClose={() => {}}
        hasNext={true}
        hasPrev={true}
        onNextCandidate={() => {}}
        onPrevCandidate={() => {}}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain("Candidate Variant 1");
    expect(html).toContain("Image Preview");
    expect(html).toContain("JSX Source");
    expect(html).toContain("SVG Source");
    expect(html).toContain("/api/sessions/sess-1/artifacts/images/cand-1.png");
    expect(html).toContain('aria-label="Previous Candidate"');
    expect(html).toContain('aria-label="Next Candidate"');
    expect(html).toContain("Download Artifacts:");
    expect(html).toContain("Version &amp; Identity");
  });
});
