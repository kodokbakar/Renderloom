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

  test("omits previous button when hasPrev is false, and next button when hasNext is false", () => {
    const firstCandHtml = renderToStaticMarkup(
      <PreviewModal
        isOpen={true}
        sessionId="sess-1"
        candidate={mockCandidate}
        session={mockSession}
        onClose={() => {}}
        onPrevCandidate={() => {}}
        onNextCandidate={() => {}}
        hasNext={true}
        hasPrev={false}
      />,
    );
    expect(firstCandHtml).not.toContain('aria-label="Previous Candidate"');
    expect(firstCandHtml).toContain('aria-label="Next Candidate"');

    const lastCandHtml = renderToStaticMarkup(
      <PreviewModal
        isOpen={true}
        sessionId="sess-1"
        candidate={mockCandidate}
        session={mockSession}
        onClose={() => {}}
        onPrevCandidate={() => {}}
        onNextCandidate={() => {}}
        hasNext={false}
        hasPrev={true}
      />,
    );
    expect(lastCandHtml).toContain('aria-label="Previous Candidate"');
    expect(lastCandHtml).not.toContain('aria-label="Next Candidate"');

    const singleCandHtml = renderToStaticMarkup(
      <PreviewModal
        isOpen={true}
        sessionId="sess-1"
        candidate={mockCandidate}
        session={mockSession}
        onClose={() => {}}
        onPrevCandidate={() => {}}
        onNextCandidate={() => {}}
        hasNext={false}
        hasPrev={false}
      />,
    );
    expect(singleCandHtml).not.toContain('aria-label="Previous Candidate"');
    expect(singleCandHtml).not.toContain('aria-label="Next Candidate"');
  });

  test("renders sanitized ErrorCard and image fallback when candidate is failed", () => {
    const failedCand: Candidate = {
      ...mockCandidate,
      state: "failed",
      errorCode: "RENDER_FAILED",
      errorMessage:
        "Satori render failed: /home/dokbakar/font.ttf invalid glyph",
    };

    const html = renderToStaticMarkup(
      <PreviewModal
        isOpen={true}
        sessionId="sess-1"
        candidate={failedCand}
        session={mockSession}
        onClose={() => {}}
      />,
    );

    expect(html).toContain("RENDER_FAILED");
    expect(html).toContain("Satori render failed: [FILE_PATH] invalid glyph");
    expect(html).not.toContain("/home/dokbakar/font.ttf");
    expect(html).toContain("Image unavailable");
  });

  test("renders ErrorCard in loading state when isRetrying is true", () => {
    const failedCand: Candidate = {
      ...mockCandidate,
      state: "failed",
      errorCode: "RENDER_FAILED",
      errorMessage: "Render timeout",
    };

    const html = renderToStaticMarkup(
      <PreviewModal
        isOpen={true}
        sessionId="sess-1"
        candidate={failedCand}
        session={mockSession}
        onClose={() => {}}
        onRetry={() => {}}
        isRetrying={true}
      />,
    );

    expect(html).toContain('data-testid="error-card-retry-button"');
    expect(html).toContain("disabled");
    expect(html).toContain("Retrying...");
  });

  test("renders ErrorCard in loading state when candidate is cancelled and isRetrying is true", () => {
    const cancelledCand: Candidate = {
      ...mockCandidate,
      state: "cancelled",
      errorCode: "USER_CANCELLED",
    };

    const html = renderToStaticMarkup(
      <PreviewModal
        isOpen={true}
        sessionId="sess-1"
        candidate={cancelledCand}
        session={mockSession}
        onClose={() => {}}
        onRetry={() => {}}
        isRetrying={true}
      />,
    );

    expect(html).toContain("Candidate Cancelled");
    expect(html).toContain('data-testid="error-card-retry-button"');
    expect(html).toContain("disabled");
    expect(html).toContain("Retrying...");
  });

  test("does not render retry button in PreviewModal when candidate is completed even if isRetrying is true", () => {
    const completedCand: Candidate = {
      ...mockCandidate,
      state: "completed",
    };

    const html = renderToStaticMarkup(
      <PreviewModal
        isOpen={true}
        sessionId="sess-1"
        candidate={completedCand}
        session={mockSession}
        onClose={() => {}}
        onRetry={() => {}}
        isRetrying={true}
      />,
    );

    expect(html).not.toContain('data-testid="error-card-retry-button"');
  });
});
