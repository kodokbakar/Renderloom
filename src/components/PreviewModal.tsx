import { useEffect, useState } from "react";
import type { Candidate } from "../domain/candidate";
import type { Session } from "../domain/session";
import { DownloadActions } from "./DownloadActions";
import { ErrorCard } from "./ErrorCard";
import { ImagePreview } from "./ImagePreview";
import { MetadataViewer } from "./MetadataViewer";
import { SourceViewer } from "./SourceViewer";
import { StatusBadge } from "./StatusBadge";
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
}: PreviewModalProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>("preview");

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
  let imageUrl: string | null = null;
  if (candidate.state === "completed" && candidate.artifacts?.pngPath) {
    const filename = candidate.artifacts.pngPath.split("/").pop();
    if (filename) {
      try {
        imageUrl = buildArtifactUrl(sessionId, "images", filename);
      } catch {
        imageUrl = null;
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
            <ErrorCard candidate={candidate} onRetry={onRetry} />
            <DownloadActions sessionId={sessionId} candidate={candidate} />
            <MetadataViewer candidate={candidate} session={session} />
          </aside>
        </div>
      </div>
    </div>
  );
}
