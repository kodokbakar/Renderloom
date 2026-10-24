import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DownloadActions } from "../../src/components/DownloadActions";
import type { Candidate } from "../../src/domain/candidate";

describe("DownloadActions", () => {
  const mockCompletedCandidate: Candidate = {
    id: "cand-1",
    sessionId: "sess-1",
    index: 0,
    state: "completed",
    artifacts: {
      pngPath: "images/cand-1-v1.png",
      svgPath: "svg/cand-1-v1.svg",
      sourcePath: "source/cand-1-v1.tsx",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  test("renders download links for PNG, SVG, and JSX when completed", () => {
    const html = renderToStaticMarkup(
      <DownloadActions sessionId="sess-1" candidate={mockCompletedCandidate} />,
    );

    expect(html).toContain("Download Artifacts:");
    expect(html).toContain(
      'href="/api/sessions/sess-1/artifacts/images/cand-1-v1.png"',
    );
    expect(html).toContain('download="cand-1-v1.png"');
    expect(html).toContain(
      'href="/api/sessions/sess-1/artifacts/svg/cand-1-v1.svg"',
    );
    expect(html).toContain('download="cand-1-v1.svg"');
    expect(html).toContain(
      'href="/api/sessions/sess-1/artifacts/source/cand-1-v1.tsx"',
    );
    expect(html).toContain('download="cand-1-v1.tsx"');
  });

  test("shows notice when candidate is not completed", () => {
    const failedCandidate: Candidate = {
      ...mockCompletedCandidate,
      state: "failed",
    };

    const html = renderToStaticMarkup(
      <DownloadActions sessionId="sess-1" candidate={failedCandidate} />,
    );

    expect(html).toContain("Downloads unavailable until generation completes.");
    expect(html).not.toContain("btn-download");
  });

  test("shows notice when candidate is cancelled or queued", () => {
    const queuedCand: Candidate = {
      ...mockCompletedCandidate,
      state: "queued",
    };
    const cancelledCand: Candidate = {
      ...mockCompletedCandidate,
      state: "cancelled",
    };

    expect(
      renderToStaticMarkup(
        <DownloadActions sessionId="sess-1" candidate={queuedCand} />,
      ),
    ).toContain("Downloads unavailable until generation completes.");

    expect(
      renderToStaticMarkup(
        <DownloadActions sessionId="sess-1" candidate={cancelledCand} />,
      ),
    ).toContain("Downloads unavailable until generation completes.");
  });

  test("handles partial artifacts (e.g. PNG only) safely", () => {
    const partialCand: Candidate = {
      ...mockCompletedCandidate,
      artifacts: {
        pngPath: "images/only-png.png",
      },
    };

    const html = renderToStaticMarkup(
      <DownloadActions sessionId="sess-1" candidate={partialCand} />,
    );

    expect(html).toContain('download="only-png.png"');
    expect(html).not.toContain(".svg");
    expect(html).not.toContain(".tsx");
  });

  test("handles completed candidate with empty artifacts object", () => {
    const emptyArtifactsCand: Candidate = {
      ...mockCompletedCandidate,
      artifacts: {},
    };

    const html = renderToStaticMarkup(
      <DownloadActions sessionId="sess-1" candidate={emptyArtifactsCand} />,
    );

    expect(html).toContain("No downloadable artifacts found.");
  });
});
