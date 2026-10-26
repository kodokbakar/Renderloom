import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BatchProgressIndicator } from "../../src/components/BatchProgressIndicator";
import type { Candidate } from "../../src/domain/candidate";

describe("BatchProgressIndicator", () => {
  const completedCandidate1: Candidate = {
    id: "c-1",
    sessionId: "sess-1",
    index: 0,
    state: "completed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const completedCandidate2: Candidate = {
    id: "c-2",
    sessionId: "sess-1",
    index: 1,
    state: "completed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const generatingCandidate: Candidate = {
    id: "c-3",
    sessionId: "sess-1",
    index: 2,
    state: "generating",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const failedCandidate: Candidate = {
    id: "c-4",
    sessionId: "sess-1",
    index: 3,
    state: "failed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  test("renders null when there are no candidates and no batchId", () => {
    const html = renderToStaticMarkup(
      <BatchProgressIndicator candidates={[]} />,
    );
    expect(html).toBe("");
  });

  test("renders progress info and percentage during running state", () => {
    const html = renderToStaticMarkup(
      <BatchProgressIndicator
        batchId="batch-1"
        status="running"
        candidates={[completedCandidate1, generatingCandidate]}
        onCancelBatch={() => {}}
      />,
    );

    expect(html).toContain("batch-progress-indicator");
    expect(html).toContain("Generating Batch (1 of 2 complete)");
    expect(html).toContain("50%");
    expect(html).toContain("btn-cancel-batch");
    expect(html).toContain("Cancel Batch");
  });

  test("does not render download bar when 0 candidates are completed", () => {
    const html = renderToStaticMarkup(
      <BatchProgressIndicator
        batchId="batch-1"
        status="running"
        candidates={[generatingCandidate, failedCandidate]}
        onDownloadAll={() => {}}
      />,
    );

    expect(html).not.toContain("batch-download-bar");
    expect(html).not.toContain("btn-download-all");
    expect(html).not.toContain("Download All (ZIP)");
  });

  test("does not render download bar when onDownloadAll callback is omitted", () => {
    const html = renderToStaticMarkup(
      <BatchProgressIndicator
        batchId="batch-1"
        status="completed"
        candidates={[completedCandidate1]}
      />,
    );

    expect(html).not.toContain("batch-download-bar");
    expect(html).not.toContain("btn-download-all");
  });

  test("renders download bar with singular summary for 1 completed candidate", () => {
    const html = renderToStaticMarkup(
      <BatchProgressIndicator
        batchId="batch-1"
        status="running"
        candidates={[completedCandidate1, generatingCandidate]}
        onDownloadAll={() => {}}
      />,
    );

    expect(html).toContain("batch-download-bar");
    expect(html).toContain(
      "1 completed candidate available for export (PNG, SVG, JSX)",
    );
    expect(html).toContain("btn-download-all");
    expect(html).toContain("Download All (ZIP)");
    expect(html).toContain('data-testid="batch-download-all-btn"');
    expect(html).toContain(
      'aria-label="Download all 1 candidate assets as ZIP"',
    );
  });

  test("renders download bar with plural summary for multiple completed candidates", () => {
    const html = renderToStaticMarkup(
      <BatchProgressIndicator
        batchId="batch-1"
        status="completed"
        candidates={[completedCandidate1, completedCandidate2]}
        onDownloadAll={() => {}}
      />,
    );

    expect(html).toContain("batch-download-bar");
    expect(html).toContain(
      "2 completed candidates available for export (PNG, SVG, JSX)",
    );
    expect(html).toContain("btn-download-all");
    expect(html).toContain("Download All (ZIP)");
    expect(html).toContain(
      'aria-label="Download all 2 candidate assets as ZIP"',
    );
  });

  test("renders loading spinner and disabled state when isDownloadingAll is true", () => {
    const html = renderToStaticMarkup(
      <BatchProgressIndicator
        batchId="batch-1"
        status="completed"
        candidates={[completedCandidate1]}
        onDownloadAll={() => {}}
        isDownloadingAll={true}
      />,
    );

    expect(html).toContain("Packaging ZIP...");
    expect(html).toContain("disabled");
    expect(html).toContain("spin");
  });

  test("renders error message when downloadError is provided", () => {
    const html = renderToStaticMarkup(
      <BatchProgressIndicator
        batchId="batch-1"
        status="completed"
        candidates={[completedCandidate1]}
        onDownloadAll={() => {}}
        downloadError="Network connection lost during packaging"
      />,
    );

    expect(html).toContain("batch-download-error");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Network connection lost during packaging");
  });

  test("renders cancel button and download bar simultaneously when running with partial completions", () => {
    const html = renderToStaticMarkup(
      <BatchProgressIndicator
        batchId="batch-1"
        status="running"
        candidates={[completedCandidate1, generatingCandidate]}
        onCancelBatch={() => {}}
        onDownloadAll={() => {}}
      />,
    );

    expect(html).toContain("btn-cancel-batch");
    expect(html).toContain("Cancel Batch");
    expect(html).toContain("batch-download-bar");
    expect(html).toContain("btn-download-all");
    expect(html).toContain(
      "1 completed candidate available for export (PNG, SVG, JSX)",
    );
  });

  test("renders partial success status text along with download bar", () => {
    const html = renderToStaticMarkup(
      <BatchProgressIndicator
        batchId="batch-1"
        status="partial_success"
        candidates={[completedCandidate1, completedCandidate2, failedCandidate]}
        onDownloadAll={() => {}}
      />,
    );

    expect(html).toContain("Partial Success (2 completed, 1 failed)");
    expect(html).toContain("batch-download-bar");
    expect(html).toContain(
      "2 completed candidates available for export (PNG, SVG, JSX)",
    );
  });

  test("does not render download bar for failed or cancelled batches when completed is 0", () => {
    const cancelledHtml = renderToStaticMarkup(
      <BatchProgressIndicator
        batchId="batch-1"
        status="cancelled"
        candidates={[{ ...failedCandidate, state: "cancelled" }]}
        onDownloadAll={() => {}}
      />,
    );
    expect(cancelledHtml).not.toContain("batch-download-bar");

    const failedHtml = renderToStaticMarkup(
      <BatchProgressIndicator
        batchId="batch-1"
        status="failed"
        candidates={[failedCandidate]}
        onDownloadAll={() => {}}
      />,
    );
    expect(failedHtml).not.toContain("batch-download-bar");
  });

  test("applies custom className and displays accurate progress percentage", () => {
    const html = renderToStaticMarkup(
      <BatchProgressIndicator
        batchId="batch-1"
        status="running"
        className="custom-batch-widget"
        candidates={[
          completedCandidate1,
          generatingCandidate,
          failedCandidate,
          completedCandidate2,
        ]}
      />,
    );

    expect(html).toContain("custom-batch-widget");
    // terminal count is 3 (2 completed + 1 failed), total is 4 -> 75%
    expect(html).toContain("75%");
    expect(html).toContain('aria-label="Batch generation progress: 75%"');
  });
});
