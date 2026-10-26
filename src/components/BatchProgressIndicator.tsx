import type { Candidate } from "../domain/candidate";
import { BanIcon, DownloadIcon, RefreshCwIcon } from "./icons";

export interface BatchProgressIndicatorProps {
  batchId?: string;
  status?: string;
  candidates?: Candidate[];
  onCancelBatch?: (batchId: string) => void;
  onDownloadAll?: () => void;
  isDownloadingAll?: boolean;
  downloadError?: string | null;
  className?: string;
}

export function BatchProgressIndicator({
  batchId,
  status = "idle",
  candidates = [],
  onCancelBatch,
  onDownloadAll,
  isDownloadingAll = false,
  downloadError = null,
  className = "",
}: BatchProgressIndicatorProps) {
  const total = candidates.length;
  if (total === 0 && !batchId) {
    return null;
  }

  const completed = candidates.filter((c) => c.state === "completed").length;
  const failed = candidates.filter((c) => c.state === "failed").length;
  const cancelled = candidates.filter((c) => c.state === "cancelled").length;
  const terminalCount = completed + failed + cancelled;

  const isRunning =
    status === "running" ||
    status === "queued" ||
    candidates.some(
      (c) =>
        c.state === "generating" ||
        c.state === "validating" ||
        c.state === "rendering" ||
        c.state === "queued",
    );

  const percent = total > 0 ? Math.round((terminalCount / total) * 100) : 0;

  return (
    <div
      className={`batch-progress-indicator status-${status} ${className}`.trim()}
      aria-live="polite"
      aria-label={`Batch generation progress: ${percent}%`}
    >
      <div className="batch-progress-header">
        <div className="batch-status-info">
          {isRunning && <RefreshCwIcon size={14} className="spin" />}
          <span className="batch-status-text">
            {isRunning
              ? `Generating Batch (${terminalCount} of ${total} complete)`
              : status === "partial_success"
                ? `Partial Success (${completed} completed, ${failed} failed)`
                : status === "completed"
                  ? `Batch Completed (${completed} successful)`
                  : status === "failed"
                    ? `Batch Failed (${failed} failed)`
                    : status === "cancelled"
                      ? "Batch Cancelled"
                      : "Batch Idle"}
          </span>
        </div>

        <div className="batch-progress-stats">
          <span className="batch-percent">{percent}%</span>
          {isRunning && batchId && onCancelBatch && (
            <button
              type="button"
              className="btn-cancel-batch"
              onClick={() => onCancelBatch(batchId)}
              aria-label="Cancel Active Batch"
            >
              <BanIcon size={12} />
              <span>Cancel Batch</span>
            </button>
          )}
        </div>
      </div>

      <div className="batch-progress-track" aria-hidden="true">
        <div className="batch-progress-fill" style={{ width: `${percent}%` }} />
      </div>

      {completed > 0 && onDownloadAll && (
        <div className="batch-download-bar">
          <span className="batch-download-summary">
            {completed} completed {completed === 1 ? "candidate" : "candidates"}{" "}
            available for export (PNG, SVG, JSX)
          </span>
          <button
            type="button"
            className="btn-download-all"
            onClick={onDownloadAll}
            disabled={isDownloadingAll}
            data-testid="batch-download-all-btn"
            aria-label={`Download all ${completed} candidate assets as ZIP`}
          >
            {isDownloadingAll ? (
              <RefreshCwIcon size={13} className="spin" />
            ) : (
              <DownloadIcon size={13} />
            )}
            <span>
              {isDownloadingAll ? "Packaging ZIP..." : "Download All (ZIP)"}
            </span>
          </button>
        </div>
      )}

      {downloadError && (
        <div
          className="batch-download-error"
          role="alert"
          data-testid="batch-download-error"
        >
          {downloadError}
        </div>
      )}
    </div>
  );
}
