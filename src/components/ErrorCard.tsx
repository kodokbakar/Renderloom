import type { Candidate } from "../domain/candidate";
import { AlertCircleIcon, RefreshCwIcon } from "./icons";
import { sanitizeErrorMessage } from "./utils/sanitize-error";

export interface ErrorCardProps {
  candidate: Candidate;
  onRetry?: (candidateId: string) => void;
  isRetrying?: boolean;
  className?: string;
}

export function ErrorCard({
  candidate,
  onRetry,
  isRetrying = false,
  className = "",
}: ErrorCardProps) {
  if (candidate.state !== "failed" && candidate.state !== "cancelled") {
    return null;
  }

  const isCancelled = candidate.state === "cancelled";
  const rawMessage = isCancelled
    ? "Generation was cancelled by the user."
    : candidate.errorMessage ||
      "An unexpected error occurred during generation.";
  const sanitized = sanitizeErrorMessage(rawMessage);

  return (
    <div
      className={`error-card state-${candidate.state} ${className}`.trim()}
      role="alert"
    >
      <div className="error-card-header">
        <div className="error-header-title">
          <AlertCircleIcon size={18} className="error-icon" />
          <h4>{isCancelled ? "Candidate Cancelled" : "Generation Error"}</h4>
        </div>
        {candidate.errorCode && (
          <span className="error-code-badge" title="Error Code">
            {candidate.errorCode}
          </span>
        )}
      </div>

      <div className="error-card-body">
        <p className="error-message-text" title={sanitized}>
          {sanitized}
        </p>
      </div>

      {onRetry && (
        <div className="error-card-actions">
          <button
            type="button"
            className="btn-retry-action"
            data-testid="error-card-retry-button"
            onClick={() => onRetry(candidate.id)}
            disabled={isRetrying}
            aria-label={
              isRetrying
                ? `Retrying candidate ${candidate.label || candidate.id}`
                : `Retry candidate ${candidate.label || candidate.id}`
            }
          >
            <RefreshCwIcon size={14} className={isRetrying ? "spin" : ""} />
            <span>{isRetrying ? "Retrying..." : "Retry Candidate"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
