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
  onModelChange?: (providerId: string, modelId: string) => void;
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
  {
    id: "custom",
    name: "Custom (OpenAI-Compatible)",
    supportsCustomBaseUrl: true,
    defaultModelId: "llama3",
    models: [
      { id: "llama3", name: "Llama 3", isDefault: true },
      { id: "mistral", name: "Mistral" },
      { id: "deepseek-chat", name: "DeepSeek Chat" },
      { id: "qwen2.5-coder", name: "Qwen 2.5 Coder" },
    ],
  },
];

const DEFAULT_STYLES: StylePresetSummary[] = [
  {
    id: "minimal",
    name: "Minimal",
    description:
      "Radical reduction, refined typographic hierarchy, quiet monochromatic palette, and supreme reliance on breath and whitespace.",
    palette: {
      background: "#FFFFFF",
      foreground: "#0F172A",
      primary: "#0F172A",
      secondary: "#64748B",
      accent: "#0284C7",
      muted: "#94A3B8",
      border: "#F1F5F9",
    },
    visualSample: {
      background: "#FFFFFF",
      foreground: "#0F172A",
      accent: "#0284C7",
      previewText: "LESS",
    },
  },
  {
    id: "bauhaus",
    name: "Bauhaus",
    description:
      "Modernist German movement emphasizing primary colors, bold geometric forms, functional hierarchy, and asymmetric balance.",
    palette: {
      background: "#F5F5F0",
      foreground: "#111111",
      primary: "#D02020",
      secondary: "#1D4ED8",
      accent: "#FBBF24",
      muted: "#71717A",
      border: "#111111",
    },
    visualSample: {
      background: "#F5F5F0",
      foreground: "#111111",
      accent: "#D02020",
      previewText: "BAUHAUS",
    },
  },
  {
    id: "brutalist",
    name: "Brutalist",
    description:
      "Raw, anti-decorative neo-brutalism defined by stark high-contrast boundaries, thick black borders, hard offset drop shadows, and monospace utility.",
    palette: {
      background: "#FFFFFF",
      foreground: "#000000",
      primary: "#000000",
      secondary: "#22C55E",
      accent: "#22C55E",
      muted: "#525252",
      border: "#000000",
    },
    visualSample: {
      background: "#FFFFFF",
      foreground: "#000000",
      accent: "#22C55E",
      previewText: "RAW",
    },
  },
  {
    id: "editorial",
    name: "Editorial",
    description:
      "Sophisticated print-publishing aesthetic featuring warm tactile surfaces, literary typography, elegant bylines, and graceful column pacing.",
    palette: {
      background: "#FAF7F2",
      foreground: "#262626",
      primary: "#171717",
      secondary: "#525252",
      accent: "#881337",
      muted: "#78716C",
      border: "#E7E5E4",
    },
    visualSample: {
      background: "#FAF7F2",
      foreground: "#262626",
      accent: "#881337",
      previewText: "PRINT",
    },
  },
  {
    id: "swiss",
    name: "Swiss International",
    description:
      "International Typographic Style rooted in mathematical precision, objective clarity, asymmetric grid alignment, and purposeful white space.",
    palette: {
      background: "#F8FAFC",
      foreground: "#0F172A",
      primary: "#E11D48",
      secondary: "#334155",
      accent: "#E11D48",
      muted: "#64748B",
      border: "#E2E8F0",
    },
    visualSample: {
      background: "#F8FAFC",
      foreground: "#0F172A",
      accent: "#E11D48",
      previewText: "GRID",
    },
  },
];

export function StudioControls({
  session,
  generationConfig,
  providers: customProviders = DEFAULT_PROVIDERS,
  styles: customStyles = DEFAULT_STYLES,
  isGenerating,
  onGenerate,
  onModelChange,
  className = "",
}: StudioControlsProps) {
  const providers =
    customProviders.length > 0 ? customProviders : DEFAULT_PROVIDERS;
  const styles = customStyles.length > 0 ? customStyles : DEFAULT_STYLES;
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
    generationConfig?.styleId || session.styleId || styles[0]?.id || "minimal";

  const [providerId, setProviderId] = useState(initialProvider);
  const [modelId, setModelId] = useState(initialModel);
  const [styleId, setStyleId] = useState(initialStyle);
  const [candidateCount, setCandidateCount] = useState<number>(
    generationConfig?.candidateCount || 4,
  );
  const [isCustomCount, setIsCustomCount] = useState<boolean>(
    (generationConfig?.candidateCount || 4) > 4,
  );
  const [storyMode, setStoryMode] = useState<boolean>(
    generationConfig?.storyMode ?? session.storyMode ?? false,
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

  useEffect(() => {
    const currentProvider =
      generationConfig?.providerId ||
      session.providerId ||
      providers[0]?.id ||
      "anthropic";
    const currentModel =
      generationConfig?.modelId ||
      session.modelId ||
      providers.find((p) => p.id === currentProvider)?.defaultModelId ||
      "claude-3-5-sonnet";
    setProviderId(currentProvider);
    setModelId(currentModel);
  }, [
    session.providerId,
    session.modelId,
    generationConfig?.providerId,
    generationConfig?.modelId,
    providers,
  ]);

  const handleProviderChange = (newProviderId: string) => {
    setProviderId(newProviderId);
    const p = providers.find((prov) => prov.id === newProviderId);
    const newModelId = p?.defaultModelId || p?.models[0]?.id || "";
    if (p) {
      setModelId(newModelId);
    }
    onModelChange?.(newProviderId, newModelId);
  };

  const handleModelChange = (newModelId: string) => {
    setModelId(newModelId);
    onModelChange?.(providerId, newModelId);
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
        storyMode,
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
          {providerId === "custom" ? (
            <>
              <input
                id="studio-model-select"
                type="text"
                className="control-select"
                data-testid="studio-custom-model-input"
                value={modelId}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={isGenerating}
                list="studio-custom-models"
                placeholder="e.g. llama3"
              />
              <datalist id="studio-custom-models">
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </datalist>
            </>
          ) : (
            <select
              id="studio-model-select"
              className="control-select"
              data-testid="studio-model-select"
              value={modelId}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={isGenerating}
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
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

        {/* Candidate Count (1 to 4 + Custom button + number input up to 10) */}
        <div className="toolbar-item count-toolbar-item">
          <span className="control-label">Count</span>
          <div className="count-pills" role="radiogroup">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                className={`pill-btn ${!isCustomCount && candidateCount === n ? "active" : ""}`}
                data-testid={`candidate-count-${n}`}
                onClick={() => {
                  setIsCustomCount(false);
                  setCandidateCount(n);
                }}
                disabled={isGenerating}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className={`pill-btn ${isCustomCount ? "active" : ""}`}
              data-testid="candidate-count-custom"
              onClick={() => {
                setIsCustomCount(true);
                if (candidateCount < 1 || candidateCount > 10) {
                  setCandidateCount(5);
                }
              }}
              disabled={isGenerating}
            >
              Custom
            </button>
            {isCustomCount && (
              <div className="custom-count-input-wrapper">
                <input
                  id="studio-custom-count-input"
                  type="number"
                  min={1}
                  max={10}
                  className="control-number-input custom-count-input"
                  data-testid="studio-custom-count-input"
                  aria-label="Custom candidate count (1 to 10)"
                  value={candidateCount}
                  onChange={(e) => {
                    const parsed = Number.parseInt(e.target.value, 10);
                    if (Number.isNaN(parsed)) {
                      setCandidateCount(1);
                    } else {
                      const clamped = Math.max(1, Math.min(10, parsed));
                      setCandidateCount(clamped);
                    }
                  }}
                  disabled={isGenerating}
                />
              </div>
            )}
          </div>
        </div>

        {/* Story Mode Toggle & Narrative Arc Badge */}
        <div className="toolbar-item story-mode-toolbar-item">
          <span className="control-label">Story Mode</span>
          <div className="story-mode-controls">
            <button
              type="button"
              className={`pill-btn story-mode-btn ${storyMode ? "active" : ""}`}
              data-testid="studio-story-mode-toggle"
              aria-pressed={storyMode}
              onClick={() => setStoryMode(!storyMode)}
              disabled={isGenerating}
              title="Toggle narrative progression (Hook -> Core -> Payoff)"
            >
              📖 Story Mode
            </button>
            {storyMode && (
              <div
                className="narrative-arc-badge"
                data-testid="narrative-arc-badge"
                aria-label="Narrative Arc Progression: Hook -> Core -> Payoff"
              >
                <span
                  className="arc-step hook"
                  title="Slide 1: Hook (Attention & Premise)"
                >
                  Hook
                </span>
                {candidateCount >= 2 && <span className="arc-arrow">→</span>}
                {candidateCount > 2 && (
                  <>
                    <span
                      className="arc-step core"
                      title={`Slides 2${candidateCount > 3 ? `-${candidateCount - 1}` : ""}: Core (Narrative Body)`}
                    >
                      Core{candidateCount > 3 ? ` ×${candidateCount - 2}` : ""}
                    </span>
                    <span className="arc-arrow">→</span>
                  </>
                )}
                {candidateCount >= 2 && (
                  <span
                    className="arc-step payoff"
                    title={`Slide ${candidateCount}: Payoff (Resolution & Climax)`}
                  >
                    Payoff
                  </span>
                )}
              </div>
            )}
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
