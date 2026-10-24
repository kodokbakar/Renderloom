import { useEffect, useState } from "react";
import type { Candidate } from "../domain/candidate";
import type { Session } from "../domain/session";
import { DownloadActions } from "./DownloadActions";
import { ErrorCard } from "./ErrorCard";
import { ImagePreview } from "./ImagePreview";
import { MetadataViewer } from "./MetadataViewer";
import { RevisionInput } from "./RevisionInput";
import { SourceViewer } from "./SourceViewer";
import { StatusBadge } from "./StatusBadge";
import { VersionHistory } from "./VersionHistory";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CodeIcon,
  ImageIcon,
  XIcon,
} from "./icons";
import { buildArtifactUrl } from "./utils/artifact-url";

export type PreviewTab = "preview" | "jsx" | "svg";

export interface PreviewModalProps {
  isOpen: boolean;
  sessionId: string;
  candidate: Candidate | null;
  session?: Session;
  onClose: () => void;
  onNextCandidate?: () => void;
  onPrevCandidate?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  onRetry?: (candidateId: string) => void;
  jsxSource?: string;
  svgSource?: string;
  isLoadingSource?: boolean;
  onRevise?: (
    candidateId: string,
    prompt: string,
    parentVersionId?: string,
  ) => Promise<void> | void;
  onRestoreVersion?: (
    candidateId: string,
    versionId: string,
  ) => Promise<void> | void;
  isRevising?: boolean;
  isRestoring?: boolean;
}

export function PreviewModal({
  isOpen,
  sessionId,
  candidate,
  session,
  onClose,
  onNextCandidate,
  onPrevCandidate,
  hasNext = false,
  hasPrev = false,
  onRetry,
  jsxSource,
  svgSource,
  isLoadingSource = false,
  onRevise,
  onRestoreVersion,
  isRevising = false,
  isRestoring = false,
}: PreviewModalProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>("preview");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );

  // Reset selected historical version when switching candidate
  useEffect(() => {
    if (candidate?.id) {
      setSelectedVersionId(null);
    }
  }, [candidate?.id]);
  // Keyboard navigation: Escape to close, ArrowLeft / ArrowRight to navigate candidates
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && hasPrev && onPrevCandidate) {
        e.preventDefault();
        onPrevCandidate();
      } else if (e.key === "ArrowRight" && hasNext && onNextCandidate) {
        e.preventDefault();
        onNextCandidate();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, hasPrev, hasNext, onClose, onPrevCandidate, onNextCandidate]);

  if (!isOpen || !candidate) {
    return null;
  }

  const displayName = candidate.label || `Candidate #${candidate.index + 1}`;

  // Image URL resolution
  const activeVersionId = candidate.currentVersionId || "v001";
  const effectiveVersionId = selectedVersionId || activeVersionId;
  const viewedVersion =
    candidate.versions?.find((v) => v.id === effectiveVersionId) ||
    candidate.versions?.[candidate.versions.length - 1];
  const isViewingHistorical = Boolean(
    selectedVersionId && selectedVersionId !== activeVersionId,
  );

  // Image URL resolution
  let imageUrl: string | null = null;
  if (candidate.state === "completed") {
    const pngPath = viewedVersion?.pngPath || candidate.artifacts?.pngPath;
    if (pngPath) {
      const filename = pngPath.split("/").pop();
      if (filename) {
        try {
          imageUrl = buildArtifactUrl(sessionId, "images", filename);
        } catch {
          imageUrl = null;
        }
      }
    }
  }
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop click dismisses modal overlay
    <div
      className="preview-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="preview-modal-dialog"
        // biome-ignore lint/a11y/useSemanticElements: Modal wrapper styled with custom flex/grid layout
        role="dialog"
        aria-modal="true"
        aria-label={`Preview: ${displayName}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        {/* Modal Header */}
        <header className="preview-modal-header">
          <div className="preview-header-info">
            <h3 className="preview-candidate-title">{displayName}</h3>
            <StatusBadge state={candidate.state} />
          </div>

          <div className="preview-header-nav">
            {hasPrev && onPrevCandidate && (
              <button
                type="button"
                className="btn-modal-nav"
                onClick={onPrevCandidate}
                aria-label="Previous Candidate"
                title="Previous Candidate (Left Arrow)"
              >
                <ChevronLeftIcon size={16} />
              </button>
            )}
            {hasNext && onNextCandidate && (
              <button
                type="button"
                className="btn-modal-nav"
                onClick={onNextCandidate}
                aria-label="Next Candidate"
                title="Next Candidate (Right Arrow)"
              >
                <ChevronRightIcon size={16} />
              </button>
            )}
            <button
              type="button"
              className="btn-modal-close"
              onClick={onClose}
              aria-label="Close Preview"
              title="Close (Escape)"
            >
              <XIcon size={18} />
            </button>
          </div>
        </header>

        {/* Modal Tab Bar */}
        <div className="preview-tab-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "preview"}
            className={`preview-tab-btn ${activeTab === "preview" ? "active" : ""}`}
            onClick={() => setActiveTab("preview")}
          >
            <ImageIcon size={14} />
            <span>Image Preview</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "jsx"}
            className={`preview-tab-btn ${activeTab === "jsx" ? "active" : ""}`}
            onClick={() => setActiveTab("jsx")}
          >
            <CodeIcon size={14} />
            <span>JSX Source</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "svg"}
            className={`preview-tab-btn ${activeTab === "svg" ? "active" : ""}`}
            onClick={() => setActiveTab("svg")}
          >
            <CodeIcon size={14} />
            <span>SVG Source</span>
          </button>
        </div>

        {/* Modal Body: Left View / Right Metadata */}
        <div className="preview-modal-body">
          <div className="preview-main-content">
            {isViewingHistorical && viewedVersion && (
              <div className="historical-view-banner">
                <span>
                  Viewing historical version{" "}
                  <strong>v{viewedVersion.versionNumber}</strong> (Active is{" "}
                  {activeVersionId})
                </span>
                {onRestoreVersion && (
                  <button
                    type="button"
                    className="btn-restore-banner"
                    disabled={isRestoring}
                    onClick={() =>
                      onRestoreVersion(candidate.id, viewedVersion.id)
                    }
                  >
                    {isRestoring ? "Restoring..." : "Restore as Active"}
                  </button>
                )}
              </div>
            )}
            {activeTab === "preview" && (
              <ImagePreview
                imageUrl={imageUrl}
                alt={displayName}
                width={session?.dimensions?.width}
                height={session?.dimensions?.height}
              />
            )}
            {activeTab === "jsx" && (
              <SourceViewer
                code={jsxSource || ""}
                language="jsx"
                title={`${displayName} — JSX Source`}
                isLoading={isLoadingSource}
              />
            )}
            {activeTab === "svg" && (
              <SourceViewer
                code={svgSource || ""}
                language="svg"
                title={`${displayName} — SVG Source`}
                isLoading={isLoadingSource}
              />
            )}
          </div>

          <aside className="preview-sidebar">
            {candidate.lastRevisionError && (
              <div className="revision-error-alert" role="alert">
                <div className="revision-error-header">
                  <strong>Revision Failed</strong>
                  {candidate.lastRevisionError.code && (
                    <span className="monospace revision-error-code">
                      {candidate.lastRevisionError.code}
                    </span>
                  )}
                </div>
                <p className="revision-error-message">
                  {candidate.lastRevisionError.message}
                </p>
                <small className="revision-error-note">
                  Active version remains usable.
                </small>
              </div>
            )}
            <RevisionInput
              candidateId={candidate.id}
              parentVersionId={activeVersionId}
              disabled={candidate.state !== "completed"}
              isSubmitting={isRevising}
              onSubmit={(prompt) =>
                onRevise?.(candidate.id, prompt, activeVersionId)
              }
            />
            {candidate.versions && candidate.versions.length > 0 && (
              <VersionHistory
                sessionId={sessionId}
                versions={candidate.versions}
                currentVersionId={activeVersionId}
                selectedVersionId={effectiveVersionId}
                onSelectVersion={(v) => setSelectedVersionId(v.id)}
                onRestoreVersion={(vId) =>
                  onRestoreVersion?.(candidate.id, vId)
                }
                isRestoring={isRestoring}
              />
            )}
            <ErrorCard candidate={candidate} onRetry={onRetry} />
            <DownloadActions sessionId={sessionId} candidate={candidate} />
            <MetadataViewer candidate={candidate} session={session} />
          </aside>
        </div>
      </div>
    </div>
  );
}
