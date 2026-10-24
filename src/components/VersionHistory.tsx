import type { Version } from "../domain/version";
import { buildArtifactUrl } from "./utils/artifact-url";

export interface VersionHistoryProps {
  sessionId: string;
  versions: Version[];
  currentVersionId?: string;
  selectedVersionId?: string;
  onSelectVersion?: (version: Version) => void;
  onRestoreVersion?: (versionId: string) => Promise<void> | void;
  isRestoring?: boolean;
  className?: string;
}

export function VersionHistory({
  sessionId,
  versions,
  currentVersionId,
  selectedVersionId,
  onSelectVersion,
  onRestoreVersion,
  isRestoring = false,
  className = "",
}: VersionHistoryProps) {
  if (!versions || versions.length === 0) {
    return null;
  }

  // Display latest versions first
  const sortedVersions = [...versions].sort(
    (a, b) => b.versionNumber - a.versionNumber,
  );

  return (
    <div className={`version-history-section ${className}`.trim()}>
      <div className="version-history-header">
        <h4 className="version-history-title">Version History</h4>
        <span className="version-count-badge">
          {versions.length} version{versions.length === 1 ? "" : "s"}
        </span>
      </div>

      <ul className="version-history-list">
        {sortedVersions.map((version) => {
          const isActive = version.id === currentVersionId;
          const isSelected =
            selectedVersionId === version.id ||
            (!selectedVersionId && isActive);
          const filename = version.pngPath.split("/").pop();
          const thumbnailUrl = filename
            ? buildArtifactUrl(sessionId, "images", filename)
            : null;

          return (
            <li key={version.id} className="version-item-container">
              <div
                className={`version-item ${isActive ? "active" : ""} ${isSelected ? "selected" : ""}`}
                onClick={() => onSelectVersion?.(version)}
                // biome-ignore lint/a11y/useSemanticElements: Version item contains interactive restore button
                role="button"
                tabIndex={0}
                aria-label={`Select version ${version.versionNumber}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectVersion?.(version);
                  }
                }}
              >
                <div className="version-thumbnail-wrapper">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={`Version ${version.versionNumber} thumbnail`}
                      className="version-thumbnail-img"
                      loading="lazy"
                    />
                  ) : (
                    <div className="version-thumbnail-placeholder monospace">
                      v{version.versionNumber}
                    </div>
                  )}
                </div>

                <div className="version-info">
                  <div className="version-header-line">
                    <span className="version-badge monospace">
                      v{version.versionNumber}
                    </span>
                    {isActive && (
                      <span className="version-status-pill active-pill">
                        Active
                      </span>
                    )}
                    {isSelected && !isActive && (
                      <span className="version-status-pill viewing-pill">
                        Viewing
                      </span>
                    )}
                    {version.parentVersionId && (
                      <span className="version-parent-ref monospace">
                        ← {version.parentVersionId}
                      </span>
                    )}
                  </div>

                  <p className="version-prompt-text">
                    {version.revisionPrompt ||
                      version.label ||
                      "Initial generation"}
                  </p>

                  <div className="version-footer-line">
                    <span className="version-timestamp">
                      {new Date(version.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    {!isActive && onRestoreVersion && (
                      <button
                        type="button"
                        className="btn-restore-version"
                        disabled={isRestoring}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRestoreVersion(version.id);
                        }}
                        title={`Restore version v${version.versionNumber} as active`}
                      >
                        {isRestoring ? "Restoring..." : "Restore"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
