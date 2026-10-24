import type { Candidate } from "../domain/candidate";
import { DownloadIcon } from "./icons";
import { buildArtifactUrl } from "./utils/artifact-url";

export interface DownloadActionsProps {
  sessionId: string;
  candidate: Candidate;
  className?: string;
}

interface ArtifactDownload {
  type: "images" | "source" | "svg";
  label: string;
  filename: string;
  url: string;
}

export function DownloadActions({
  sessionId,
  candidate,
  className = "",
}: DownloadActionsProps) {
  if (candidate.state !== "completed" || !candidate.artifacts) {
    return (
      <div className={`download-actions disabled ${className}`.trim()}>
        <span className="download-notice">
          Downloads unavailable until generation completes.
        </span>
      </div>
    );
  }

  const downloads: ArtifactDownload[] = [];

  // 1. PNG Image
  if (candidate.artifacts.pngPath) {
    const filename = candidate.artifacts.pngPath.split("/").pop();
    if (filename) {
      try {
        const url = buildArtifactUrl(sessionId, "images", filename);
        downloads.push({ type: "images", label: "PNG Image", filename, url });
      } catch {
        // Ignored if invalid
      }
    }
  }

  // 2. SVG Vector
  if (candidate.artifacts.svgPath) {
    const filename = candidate.artifacts.svgPath.split("/").pop();
    if (filename) {
      try {
        const url = buildArtifactUrl(sessionId, "svg", filename);
        downloads.push({ type: "svg", label: "SVG Vector", filename, url });
      } catch {
        // Ignored if invalid
      }
    }
  }

  // 3. JSX Source
  if (candidate.artifacts.sourcePath) {
    const filename = candidate.artifacts.sourcePath.split("/").pop();
    if (filename) {
      try {
        const url = buildArtifactUrl(sessionId, "source", filename);
        downloads.push({ type: "source", label: "JSX Source", filename, url });
      } catch {
        // Ignored if invalid
      }
    }
  }

  if (downloads.length === 0) {
    return (
      <div className={`download-actions empty ${className}`.trim()}>
        <span className="download-notice">
          No downloadable artifacts found.
        </span>
      </div>
    );
  }

  return (
    <div className={`download-actions ${className}`.trim()}>
      <span className="download-actions-title">Download Artifacts:</span>
      <div className="download-buttons-group">
        {downloads.map((item) => (
          <a
            key={item.type}
            href={item.url}
            download={item.filename}
            className={`btn-download btn-download-${item.type}`}
            aria-label={`Download ${item.label} (${item.filename})`}
          >
            <DownloadIcon size={14} />
            <span>{item.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
