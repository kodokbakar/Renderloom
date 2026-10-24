import React from "react";
import type { Candidate } from "../domain/candidate";
import { CandidateCard } from "./CandidateCard";
import { EmptyState } from "./EmptyState";

export interface CandidateGalleryProps {
  sessionId: string;
  candidates: Candidate[];
  selectedCandidateId?: string;
  onSelectCandidate: (candidate: Candidate) => void;
  onInspectCandidate?: (candidate: Candidate) => void;
  onRetryCandidate?: (candidateId: string) => void;
  isGenerating?: boolean;
  className?: string;
}

export function CandidateGallery({
  sessionId,
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  onInspectCandidate,
  onRetryCandidate,
  isGenerating = false,
  className = "",
}: CandidateGalleryProps) {
  if (candidates.length === 0) {
    if (isGenerating) {
      return (
        <div className={`candidate-gallery ${className}`.trim()}>
          <EmptyState type="generating" />
        </div>
      );
    }
    return (
      <div className={`candidate-gallery ${className}`.trim()}>
        <EmptyState type="new-session" />
      </div>
    );
  }

  // Check if all finished candidates failed/cancelled and none completed
  const allCompleted = candidates.filter((c) => c.state === "completed");
  const allTerminal = candidates.every(
    (c) =>
      c.state === "completed" ||
      c.state === "failed" ||
      c.state === "cancelled",
  );
  const showNoSuccessNotice =
    allTerminal &&
    allCompleted.length === 0 &&
    !isGenerating &&
    candidates.length > 0;

  return (
    <div className={`candidate-gallery ${className}`.trim()}>
      {showNoSuccessNotice && (
        <div className="gallery-notice-banner warning" role="alert">
          <span>
            None of the candidates completed successfully in this batch. Review
            individual failure details below or retry failed jobs.
          </span>
        </div>
      )}

      <section
        className="candidate-gallery-grid"
        aria-label="Generated Candidates Gallery"
      >
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            sessionId={sessionId}
            isSelected={selectedCandidateId === candidate.id}
            onSelect={onSelectCandidate}
            onInspect={onInspectCandidate}
            onRetry={onRetryCandidate}
          />
        ))}
      </section>
    </div>
  );
}
