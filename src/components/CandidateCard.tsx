import type React from "react";
import { useState } from "react";
import type { Candidate } from "../domain/candidate";
import { StatusBadge } from "./StatusBadge";
import { AlertCircleIcon, BanIcon, ImageIcon, RefreshCwIcon } from "./icons";
import { buildArtifactUrl } from "./utils/artifact-url";
import { formatCandidateDuration } from "./utils/format-timing";
import { sanitizeErrorMessage } from "./utils/sanitize-error";

export interface CandidateCardProps {
  candidate: Candidate;
  sessionId: string;
  isSelected?: boolean;
  onSelect?: (candidate: Candidate) => void;
  onRetry?: (candidateId: string) => void;
  onInspect?: (candidate: Candidate) => void;
}

export function CandidateCard({
  candidate,
  sessionId,
  isSelected = false,
  onSelect,
  onRetry,
  onInspect,
}: CandidateCardProps) {
  const [imgError, setImgError] = useState(false);

  const displayName = candidate.label || `Candidate #${candidate.index + 1}`;
  const duration = formatCandidateDuration(candidate.timings);

  // Extract raw filename from candidate.artifacts.pngPath (e.g. "images/foo.png" -> "foo.png")
  let imageUrl: string | null = null;
  if (candidate.state === "completed" && candidate.artifacts?.pngPath) {
    const rawFilename = candidate.artifacts.pngPath.split("/").pop();
    if (rawFilename) {
      try {
        imageUrl = buildArtifactUrl(sessionId, "images", rawFilename);
      } catch {
        imageUrl = null;
      }
    }
  }

  const handleClick = () => {
    onSelect?.(candidate);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.(candidate);
    }
  };

  const handleRetryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRetry?.(candidate.id);
  };

  const handleInspectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInspect?.(candidate);
  };

  return (
    <div
      className={`candidate-card ${isSelected ? "selected" : ""} state-${candidate.state}`}
      data-candidate-id={candidate.id}
      data-candidate-state={candidate.state}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      // biome-ignore lint/a11y/useSemanticElements: Composite card container requires click & keyboard selection
      role="button"
      aria-pressed={isSelected}
      aria-label={`${displayName}, ${candidate.state}`}
    >
      <div className="candidate-card-header">
        <span className="candidate-name" title={displayName}>
          {displayName}
        </span>
        <div className="candidate-header-badges">
          {duration !== "—" && (
            <span className="candidate-duration" title="Duration">
              {duration}
            </span>
          )}
          <StatusBadge state={candidate.state} />
        </div>
      </div>

      <div className="candidate-card-media">
        {candidate.state === "completed" && imageUrl && !imgError ? (
          <div className="candidate-thumb-container">
            <img
              src={imageUrl}
              alt={displayName}
              className="candidate-thumb-img"
              loading="lazy"
              onError={() => setImgError(true)}
            />
            {onInspect && (
              <button
                type="button"
                className="btn-inspect-overlay"
                onClick={handleInspectClick}
                aria-label={`Inspect ${displayName}`}
              >
                Inspect
              </button>
            )}
          </div>
        ) : candidate.state === "completed" && (imgError || !imageUrl) ? (
          <div className="candidate-media-fallback unavailable">
            <ImageIcon size={28} />
            <span>Artifact unavailable</span>
          </div>
        ) : candidate.state === "failed" ? (
          <div className="candidate-media-fallback failed">
            <AlertCircleIcon size={28} />
            {(() => {
              const errSnippet = sanitizeErrorMessage(
                candidate.errorMessage || "Generation failed",
              );
              return (
                <p className="failure-snippet" title={errSnippet}>
                  {errSnippet}
                </p>
              );
            })()}
            {onRetry && (
              <button
                type="button"
                className="btn-card-retry"
                onClick={handleRetryClick}
                aria-label={`Retry ${displayName}`}
              >
                <RefreshCwIcon size={12} /> Retry
              </button>
            )}
          </div>
        ) : candidate.state === "cancelled" ? (
          <div className="candidate-media-fallback cancelled">
            <BanIcon size={28} />
            <span>Generation cancelled</span>
            {onRetry && (
              <button
                type="button"
                className="btn-card-retry"
                onClick={handleRetryClick}
                aria-label={`Retry ${displayName}`}
              >
                <RefreshCwIcon size={12} /> Retry
              </button>
            )}
          </div>
        ) : (
          <div className="candidate-media-fallback in-progress">
            <RefreshCwIcon size={24} className="spin" />
            <span className="progress-label">
              {candidate.state === "validating"
                ? "Validating AST..."
                : candidate.state === "rendering"
                  ? "Rendering PNG..."
                  : candidate.state === "generating"
                    ? "Generating code..."
                    : "Queued..."}
            </span>
          </div>
        )}
      </div>

      {candidate.rationale && (
        <div className="candidate-card-footer">
          <p className="candidate-rationale" title={candidate.rationale}>
            {candidate.rationale}
          </p>
        </div>
      )}
    </div>
  );
}
