import { useEffect, useState } from "react";
import type { AspectRatioPreset } from "../domain/dimensions";
import type { ProviderMeta } from "../domain/provider";
import type { GenerationRequest } from "../domain/request";
import type { GenerationConfig, Session } from "../domain/session";
import type { StylePresetSummary } from "../domain/style";

export interface StudioControlsProps {
  session: Session;
  generationConfig?: GenerationConfig;
  providers?: ProviderMeta[];
  styles?: StylePresetSummary[];
  isGenerating: boolean;
  onGenerate: (payload: GenerationRequest) => Promise<void>;
  className?: string;
}

const PRESET_DIMENSIONS: Record<
  Exclude<AspectRatioPreset, "custom">,
  { width: number; height: number; label: string }
> = {
  "1:1": { width: 1024, height: 1024, label: "1:1" },
  "4:5": { width: 1080, height: 1350, label: "4:5" },
  "3:2": { width: 1200, height: 800, label: "3:2" },
  "16:9": { width: 1920, height: 1080, label: "16:9" },
};

const DEFAULT_PROVIDERS: ProviderMeta[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    supportsCustomBaseUrl: true,
    defaultModelId: "claude-3-5-sonnet",
    models: [
      { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", isDefault: true },
      { id: "claude-3-opus", name: "Claude 3 Opus" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    supportsCustomBaseUrl: false,
    defaultModelId: "gpt-4o",
    models: [
      { id: "gpt-4o", name: "GPT-4o", isDefault: true },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    ],
  },
];

const DEFAULT_STYLES: StylePresetSummary[] = [
  {
    id: "tech-minimal",
    name: "Tech Minimal",
    description: "Crisp vector geometry",
    palette: {
      background: "#0d0e11",
      foreground: "#f3f4f6",
      primary: "#e5a84b",
      accent: "#e5a84b",
    },
    visualSample: {
      background: "#0d0e11",
      foreground: "#f3f4f6",
      accent: "#e5a84b",
    },
  },
  {
    id: "modern-clean",
    name: "Modern Clean",
    description: "Airy balance",
    palette: {
      background: "#ffffff",
      foreground: "#111827",
      primary: "#3b82f6",
      accent: "#6366f1",
    },
    visualSample: {
      background: "#ffffff",
      foreground: "#111827",
      accent: "#3b82f6",
    },
  },
];

export function StudioControls({
  session,
  generationConfig,
  providers = DEFAULT_PROVIDERS,
  styles = DEFAULT_STYLES,
  isGenerating,
  onGenerate,
  className = "",
}: StudioControlsProps) {
  const initialProvider =
    generationConfig?.providerId ||
    session.providerId ||
    providers[0]?.id ||
    "anthropic";
  const initialModel =
    generationConfig?.modelId ||
    session.modelId ||
    providers.find((p) => p.id === initialProvider)?.defaultModelId ||
    "claude-3-5-sonnet";
  const initialStyle =
    generationConfig?.styleId ||
    session.styleId ||
    styles[0]?.id ||
    "tech-minimal";

  const [providerId, setProviderId] = useState(initialProvider);
  const [modelId, setModelId] = useState(initialModel);
  const [styleId, setStyleId] = useState(initialStyle);
  const [candidateCount, setCandidateCount] = useState<number>(
    generationConfig?.candidateCount || 4,
  );

  // Aspect ratio detection from width/height
  const initialWidth =
    generationConfig?.width || session.dimensions?.width || 1024;
  const initialHeight =
    generationConfig?.height || session.dimensions?.height || 1024;

  const detectPreset = (w: number, h: number): AspectRatioPreset => {
    for (const [key, preset] of Object.entries(PRESET_DIMENSIONS)) {
      if (preset.width === w && preset.height === h) {
        return key as AspectRatioPreset;
      }
    }
    return "custom";
  };

  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>(
    detectPreset(initialWidth, initialHeight),
  );
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Sync model list when provider changes
  const activeProvider =
    providers.find((p) => p.id === providerId) || providers[0];
  const availableModels = activeProvider?.models || [];

  const handleProviderChange = (newProviderId: string) => {
    setProviderId(newProviderId);
    const p = providers.find((prov) => prov.id === newProviderId);
    if (p) {
      setModelId(p.defaultModelId || p.models[0]?.id || "");
    }
  };

  const handleAspectRatioChange = (ratio: AspectRatioPreset) => {
    setAspectRatio(ratio);
    if (ratio !== "custom") {
      setWidth(PRESET_DIMENSIONS[ratio].width);
      setHeight(PRESET_DIMENSIONS[ratio].height);
    }
  };

  const activeStyle = styles.find((s) => s.id === styleId) || styles[0];

  const handleTriggerGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setError(null);

    try {
      await onGenerate({
        sessionId: session.id,
        prompt: prompt.trim(),
        providerId,
        modelId,
        styleId,
        candidateCount,
        width,
        height,
        aspectRatio,
        outputFormat: "png",
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to start generation",
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleTriggerGenerate();
    }
  };

  return (
    <section
      className={`studio-controls ${className}`.trim()}
      aria-label="Studio Generation Controls"
    >
      {/* Parameter Toolbar */}
      <div className="controls-toolbar">
        {/* Provider & Model */}
        <div className="toolbar-item">
          <label htmlFor="studio-provider-select" className="control-label">
            Provider
          </label>
          <select
            id="studio-provider-select"
            className="control-select"
            data-testid="studio-provider-select"
            value={providerId}
            onChange={(e) => handleProviderChange(e.target.value)}
            disabled={isGenerating}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-item">
          <label htmlFor="studio-model-select" className="control-label">
            Model
          </label>
          <select
            id="studio-model-select"
            className="control-select"
            data-testid="studio-model-select"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            disabled={isGenerating}
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Style Preset with Palette Swatch Preview */}
        <div className="toolbar-item style-picker-item">
          <label htmlFor="studio-style-select" className="control-label">
            Style Preset
          </label>
          <div className="style-select-group">
            <select
              id="studio-style-select"
              className="control-select"
              data-testid="studio-style-select"
              value={styleId}
              onChange={(e) => setStyleId(e.target.value)}
              disabled={isGenerating}
            >
              {styles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {activeStyle?.palette && (
              <div
                className="palette-swatches-preview"
                title={`Active palette: ${activeStyle.name}`}
                data-testid="style-swatches"
              >
                <span
                  className="swatch-dot"
                  style={{ backgroundColor: activeStyle.palette.background }}
                />
                <span
                  className="swatch-dot"
                  style={{ backgroundColor: activeStyle.palette.foreground }}
                />
                <span
                  className="swatch-dot"
                  style={{ backgroundColor: activeStyle.palette.primary }}
                />
                <span
                  className="swatch-dot"
                  style={{ backgroundColor: activeStyle.palette.accent }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Aspect Ratio Presets */}
        <div className="toolbar-item">
          <span className="control-label">Aspect Ratio</span>
          <div className="ratio-pills" role="radiogroup">
            {(
              ["1:1", "4:5", "3:2", "16:9", "custom"] as AspectRatioPreset[]
            ).map((preset) => (
              <button
                key={preset}
                type="button"
                className={`pill-btn ${aspectRatio === preset ? "active" : ""}`}
                data-testid={`studio-ratio-${preset}`}
                onClick={() => handleAspectRatioChange(preset)}
                disabled={isGenerating}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Candidate Count (1 to 4) */}
        <div className="toolbar-item">
          <span className="control-label">Count</span>
          <div className="count-pills" role="radiogroup">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                className={`pill-btn ${candidateCount === n ? "active" : ""}`}
                data-testid={`candidate-count-${n}`}
                onClick={() => setCandidateCount(n)}
                disabled={isGenerating}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom dimensions inputs if custom selected */}
      {aspectRatio === "custom" && (
        <div className="custom-dims-inline">
          <div className="dim-input-group">
            <label htmlFor="studio-custom-width" className="sub-label">
              Width
            </label>
            <input
              id="studio-custom-width"
              type="number"
              min={64}
              max={4096}
              className="control-number-input"
              data-testid="studio-custom-width"
              value={width}
              onChange={(e) =>
                setWidth(Number.parseInt(e.target.value, 10) || 0)
              }
              disabled={isGenerating}
            />
          </div>
          <span className="dim-separator">×</span>
          <div className="dim-input-group">
            <label htmlFor="studio-custom-height" className="sub-label">
              Height
            </label>
            <input
              id="studio-custom-height"
              type="number"
              min={64}
              max={4096}
              className="control-number-input"
              data-testid="studio-custom-height"
              value={height}
              onChange={(e) =>
                setHeight(Number.parseInt(e.target.value, 10) || 0)
              }
              disabled={isGenerating}
            />
          </div>
          <span className="dim-unit">px</span>
        </div>
      )}

      {/* Prompt Composer & Generate Trigger */}
      <div className="prompt-composer">
        {error && (
          <div className="prompt-composer-error" role="alert">
            {error}
          </div>
        )}
        <div className="prompt-textarea-wrapper">
          <textarea
            className="prompt-textarea"
            data-testid="studio-prompt-input"
            rows={2}
            placeholder="Describe your image composition in natural language... (Ctrl+Enter to generate)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={4000}
            disabled={isGenerating}
          />
          <div className="prompt-composer-footer">
            <span className="char-counter" data-testid="prompt-char-count">
              {prompt.length} / 4000
            </span>
            <button
              type="button"
              className="btn-generate"
              data-testid="generate-btn"
              disabled={isGenerating || !prompt.trim()}
              onClick={handleTriggerGenerate}
            >
              {isGenerating ? (
                <>
                  <span className="btn-spinner" /> Generating...
                </>
              ) : (
                "Generate ✦"
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
