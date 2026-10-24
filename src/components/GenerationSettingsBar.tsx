import type { GenerationConfig, Session } from "../domain/session";

export interface GenerationSettingsBarProps {
  session: Session;
  generationConfig?: GenerationConfig;
  className?: string;
}

export function GenerationSettingsBar({
  session,
  generationConfig,
  className = "",
}: GenerationSettingsBarProps) {
  const provider = generationConfig?.providerId || session.providerId;
  const model = generationConfig?.modelId || session.modelId;
  const style = generationConfig?.styleId || session.styleId;
  const width = generationConfig?.width || session.dimensions.width;
  const height = generationConfig?.height || session.dimensions.height;
  const count =
    generationConfig?.candidateCount || session.candidates?.length || 4;

  return (
    <section
      className={`generation-settings-bar ${className}`.trim()}
      aria-label="Generation Settings"
    >
      <div className="settings-chips-group">
        <div className="settings-chip">
          <span className="chip-label">Provider:</span>
          <span className="chip-value">{provider}</span>
        </div>

        <div className="settings-chip">
          <span className="chip-label">Model:</span>
          <span className="chip-value">{model}</span>
        </div>

        <div className="settings-chip">
          <span className="chip-label">Style:</span>
          <span className="chip-value">{style}</span>
        </div>

        <div className="settings-chip">
          <span className="chip-label">Dimensions:</span>
          <span className="chip-value">
            {width} × {height}
          </span>
        </div>

        <div className="settings-chip">
          <span className="chip-label">Candidates:</span>
          <span className="chip-value">{count}</span>
        </div>
      </div>
    </section>
  );
}
