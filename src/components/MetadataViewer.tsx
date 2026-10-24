import type { Candidate } from "../domain/candidate";
import type { Session } from "../domain/session";
import { formatTimingDuration } from "./utils/format-timing";

export interface MetadataViewerProps {
  candidate: Candidate;
  session?: Session;
  className?: string;
}

function computePhaseDuration(
  start?: string,
  end?: string,
): number | undefined {
  if (!start || !end) return undefined;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs) {
    return endMs - startMs;
  }
  return undefined;
}

export function MetadataViewer({
  candidate,
  session,
  className = "",
}: MetadataViewerProps) {
  const versionId = candidate.currentVersionId || "v1";
  const activeVersion =
    candidate.versions?.find((v) => v.id === versionId) ||
    candidate.versions?.[candidate.versions.length - 1];
  const timings = candidate.timings;
  const totalDuration = timings?.durationMs;
  const genDuration = computePhaseDuration(
    timings?.generationStartedAt,
    timings?.generationEndedAt,
  );
  const valDuration = computePhaseDuration(
    timings?.validationStartedAt,
    timings?.validationEndedAt,
  );
  const renderDuration = computePhaseDuration(
    timings?.renderingStartedAt,
    timings?.renderingEndedAt,
  );

  const width = session?.dimensions?.width;
  const height = session?.dimensions?.height;
  const dimensionStr = width && height ? `${width} × ${height} px` : undefined;

  return (
    <div className={`metadata-viewer ${className}`.trim()}>
      <div className="metadata-section">
        <h4 className="metadata-title">Version & Identity</h4>
        <dl className="metadata-list">
          <div className="metadata-item">
            <dt>Version ID</dt>
            <dd className="monospace">{versionId}</dd>
          </div>
          {activeVersion?.parentVersionId && (
            <div className="metadata-item">
              <dt>Parent Version</dt>
              <dd className="monospace">{activeVersion.parentVersionId}</dd>
            </div>
          )}
          {activeVersion?.revisionPrompt && (
            <div className="metadata-item full-width">
              <dt>Revision Prompt</dt>
              <dd className="revision-prompt-text">
                {activeVersion.revisionPrompt}
              </dd>
            </div>
          )}
          <div className="metadata-item">
            <dt>Candidate ID</dt>
            <dd className="monospace">{candidate.id}</dd>
          </div>
          {candidate.label && (
            <div className="metadata-item">
              <dt>Label</dt>
              <dd>{candidate.label}</dd>
            </div>
          )}
          {candidate.rationale && (
            <div className="metadata-item full-width">
              <dt>Design Rationale</dt>
              <dd className="rationale-text">{candidate.rationale}</dd>
            </div>
          )}
        </dl>
      </div>

      {session && (
        <div className="metadata-section">
          <h4 className="metadata-title">Generation Configuration</h4>
          <dl className="metadata-list">
            <div className="metadata-item">
              <dt>Provider</dt>
              <dd>{session.providerId}</dd>
            </div>
            <div className="metadata-item">
              <dt>Model</dt>
              <dd>{session.modelId}</dd>
            </div>
            <div className="metadata-item">
              <dt>Style</dt>
              <dd>{session.styleId}</dd>
            </div>
            {dimensionStr && (
              <div className="metadata-item">
                <dt>Dimensions</dt>
                <dd>{dimensionStr}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <div className="metadata-section">
        <h4 className="metadata-title">Execution Timings</h4>
        <dl className="metadata-list">
          <div className="metadata-item">
            <dt>Total Duration</dt>
            <dd className="highlight">{formatTimingDuration(totalDuration)}</dd>
          </div>
          {genDuration !== undefined && (
            <div className="metadata-item">
              <dt>Code Generation</dt>
              <dd>{formatTimingDuration(genDuration)}</dd>
            </div>
          )}
          {valDuration !== undefined && (
            <div className="metadata-item">
              <dt>AST Validation</dt>
              <dd>{formatTimingDuration(valDuration)}</dd>
            </div>
          )}
          {renderDuration !== undefined && (
            <div className="metadata-item">
              <dt>PNG Rendering</dt>
              <dd>{formatTimingDuration(renderDuration)}</dd>
            </div>
          )}
          {candidate.retries !== undefined && candidate.retries > 0 && (
            <div className="metadata-item">
              <dt>Retries</dt>
              <dd>{candidate.retries}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
