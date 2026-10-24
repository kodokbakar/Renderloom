import { useEffect, useState } from "react";
import type { AspectRatioPreset } from "../domain/dimensions";
import type { ProviderMeta } from "../domain/provider";
import type { CreateSessionRequest } from "../domain/request";
import type { StylePresetSummary } from "../domain/style";

export interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CreateSessionRequest) => Promise<void>;
  providers?: ProviderMeta[];
  styles?: StylePresetSummary[];
  isLoading?: boolean;
}

const PRESET_DIMENSIONS: Record<
  Exclude<AspectRatioPreset, "custom">,
  { width: number; height: number; label: string }
> = {
  "1:1": { width: 1024, height: 1024, label: "1:1 (Square)" },
  "4:5": { width: 1080, height: 1350, label: "4:5 (Portrait)" },
  "3:2": { width: 1200, height: 800, label: "3:2 (Classic)" },
  "16:9": { width: 1920, height: 1080, label: "16:9 (Widescreen)" },
};

const DEFAULT_STYLES: StylePresetSummary[] = [
  {
    id: "tech-minimal",
    name: "Tech Minimal",
    description: "Crisp vector geometry and dark monochrome canvas",
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
    description: "Balanced sans typography and airy negative space",
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

export function NewSessionModal({
  isOpen,
  onClose,
  onCreate,
  providers = DEFAULT_PROVIDERS,
  styles = DEFAULT_STYLES,
  isLoading = false,
}: NewSessionModalProps) {
  const [name, setName] = useState("");
  const [providerId, setProviderId] = useState(providers[0]?.id || "anthropic");
  const [modelId, setModelId] = useState(
    providers[0]?.defaultModelId || "claude-3-5-sonnet",
  );
  const [styleId, setStyleId] = useState(styles[0]?.id || "tech-minimal");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>("1:1");
  const [customWidth, setCustomWidth] = useState(1024);
  const [customHeight, setCustomHeight] = useState(1024);
  const [initialPrompt, setInitialPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync modelId when providerId changes
  useEffect(() => {
    const currentProvider = providers.find((p) => p.id === providerId);
    if (currentProvider) {
      setModelId(
        currentProvider.defaultModelId || currentProvider.models[0]?.id || "",
      );
    }
  }, [providerId, providers]);

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentProvider =
    providers.find((p) => p.id === providerId) || providers[0];
  const availableModels = currentProvider?.models || [];

  const width =
    aspectRatio === "custom"
      ? customWidth
      : PRESET_DIMENSIONS[aspectRatio].width;
  const height =
    aspectRatio === "custom"
      ? customHeight
      : PRESET_DIMENSIONS[aspectRatio].height;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Session name is required");
      return;
    }

    if (width < 64 || height < 64 || width > 4096 || height > 4096) {
      setError("Dimensions must be between 64 and 4096 pixels");
      return;
    }

    if (width * height > 4_194_304) {
      setError("Total canvas pixels cannot exceed 4 Megapixels");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onCreate({
        name: name.trim(),
        providerId,
        modelId,
        styleId,
        width,
        height,
        aspectRatio,
        initialPrompt: initialPrompt.trim() ? initialPrompt.trim() : undefined,
      });
      // Reset form
      setName("");
      setInitialPrompt("");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop click dismisses modal overlay
    <div
      className="modal-backdrop"
      data-testid="new-session-modal"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal-dialog new-session-modal"
        // biome-ignore lint/a11y/useSemanticElements: Modal wrapper styled with custom flex layout
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-session-modal-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge">STUDIO</span>
            <h2 id="new-session-modal-title" className="modal-title">
              Create New Session
            </h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            data-testid="create-session-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="new-session-form">
          {error && (
            <div className="modal-alert-banner error" role="alert">
              {error}
            </div>
          )}

          {/* Session Name */}
          <div className="form-field">
            <label htmlFor="new-session-name" className="field-label">
              Session Name <span className="required">*</span>
            </label>
            <input
              id="new-session-name"
              type="text"
              className="modal-text-input"
              data-testid="new-session-name-input"
              placeholder="e.g. Atelier Logo Concept"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          {/* Provider & Model */}
          <div className="form-row">
            <div className="form-field flex-1">
              <label htmlFor="new-session-provider" className="field-label">
                Provider
              </label>
              <select
                id="new-session-provider"
                className="modal-select"
                data-testid="new-session-provider-select"
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field flex-1">
              <label htmlFor="new-session-model" className="field-label">
                Model
              </label>
              <select
                id="new-session-model"
                className="modal-select"
                data-testid="new-session-model-select"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Style Preset */}
          <div className="form-field">
            <label htmlFor="new-session-style" className="field-label">
              Style Preset
            </label>
            <select
              id="new-session-style"
              className="modal-select"
              data-testid="new-session-style-select"
              value={styleId}
              onChange={(e) => setStyleId(e.target.value)}
            >
              {styles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.description}
                </option>
              ))}
            </select>
          </div>

          {/* Aspect Ratio & Dimensions */}
          <div className="form-field">
            <span className="field-label">Aspect Ratio & Canvas Size</span>
            <div className="aspect-ratio-buttons" role="radiogroup">
              {(
                ["1:1", "4:5", "3:2", "16:9", "custom"] as AspectRatioPreset[]
              ).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`ratio-btn ${aspectRatio === preset ? "active" : ""}`}
                  data-testid={`ratio-btn-${preset}`}
                  onClick={() => setAspectRatio(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>

            {aspectRatio === "custom" ? (
              <div className="form-row custom-dims-row">
                <div className="form-field flex-1">
                  <label htmlFor="custom-width" className="sub-label">
                    Width (px)
                  </label>
                  <input
                    id="custom-width"
                    type="number"
                    min={64}
                    max={4096}
                    className="modal-text-input"
                    data-testid="custom-width-input"
                    value={customWidth}
                    onChange={(e) =>
                      setCustomWidth(Number.parseInt(e.target.value, 10) || 0)
                    }
                  />
                </div>
                <div className="form-field flex-1">
                  <label htmlFor="custom-height" className="sub-label">
                    Height (px)
                  </label>
                  <input
                    id="custom-height"
                    type="number"
                    min={64}
                    max={4096}
                    className="modal-text-input"
                    data-testid="custom-height-input"
                    value={customHeight}
                    onChange={(e) =>
                      setCustomHeight(Number.parseInt(e.target.value, 10) || 0)
                    }
                  />
                </div>
              </div>
            ) : (
              <span className="dimension-display">
                {width} × {height} px ({PRESET_DIMENSIONS[aspectRatio].label})
              </span>
            )}
          </div>

          {/* Initial Prompt (Optional) */}
          <div className="form-field">
            <label htmlFor="new-session-prompt" className="field-label">
              Initial Prompt (optional)
            </label>
            <textarea
              id="new-session-prompt"
              className="modal-textarea"
              data-testid="new-session-prompt-input"
              rows={3}
              placeholder="Describe the initial visual composition or components to draft..."
              value={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
              maxLength={4000}
            />
          </div>

          <footer className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              data-testid="create-session-cancel"
              onClick={onClose}
              disabled={isSubmitting || isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              data-testid="create-session-submit"
              disabled={isSubmitting || isLoading || !name.trim()}
            >
              {isSubmitting || isLoading ? "Launching..." : "Launch Studio →"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
