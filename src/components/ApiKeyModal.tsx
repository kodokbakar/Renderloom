import { useEffect, useState } from "react";
import type { ProviderMeta } from "../domain/provider";
import type { KeyStatusInfo } from "../llm/keystore";

export interface EnrichedProviderMeta extends ProviderMeta {
  status?: KeyStatusInfo;
}

export interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProviders?: EnrichedProviderMeta[];
}

export function ApiKeyModal({
  isOpen,
  onClose,
  initialProviders,
}: ApiKeyModalProps) {
  const [providers, setProviders] = useState<EnrichedProviderMeta[]>(
    initialProviders || [],
  );
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [baseUrlInputs, setBaseUrlInputs] = useState<Record<string, string>>(
    {},
  );
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; latencyMs?: number; error?: string }>
  >({});
  const [isTesting, setIsTesting] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [isRemoving, setIsRemoving] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchProviders = async () => {
    try {
      const res = await fetch("/api/llm/providers");
      if (res.ok) {
        const data = (await res.json()) as {
          providers: EnrichedProviderMeta[];
        };
        setProviders(data.providers || []);
      }
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (!initialProviders || initialProviders.length === 0) {
        const loadProviders = async () => {
          try {
            const res = await fetch("/api/llm/providers");
            if (res.ok) {
              const data = (await res.json()) as {
                providers: EnrichedProviderMeta[];
              };
              setProviders(data.providers || []);
            }
          } catch {
            // Offline fallback
          }
        };
        loadProviders();
      } else {
        setProviders(initialProviders);
      }
    }
  }, [isOpen, initialProviders]);

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

  const handleTestConnection = async (provider: EnrichedProviderMeta) => {
    setIsTesting((prev) => ({ ...prev, [provider.id]: true }));
    setFeedback(null);
    try {
      const enteredKey = keyInputs[provider.id]?.trim();
      const enteredBaseUrl = baseUrlInputs[provider.id]?.trim();

      const res = await fetch("/api/llm/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: provider.id,
          apiKey: enteredKey || undefined,
          baseUrl: enteredBaseUrl || undefined,
          modelId: provider.defaultModelId,
        }),
      });

      const data = (await res.json()) as {
        success: boolean;
        latencyMs?: number;
        error?: string;
      };

      setTestResults((prev) => ({
        ...prev,
        [provider.id]: {
          success: data.success,
          latencyMs: data.latencyMs,
          error: data.error,
        },
      }));
    } catch (err: unknown) {
      setTestResults((prev) => ({
        ...prev,
        [provider.id]: {
          success: false,
          error: err instanceof Error ? err.message : "Connection failed",
        },
      }));
    } finally {
      setIsTesting((prev) => ({ ...prev, [provider.id]: false }));
    }
  };

  const handleSaveKey = async (provider: EnrichedProviderMeta) => {
    const isCustom = provider.id === "custom";
    const enteredKey = keyInputs[provider.id]?.trim();
    const enteredBaseUrl = baseUrlInputs[provider.id]?.trim();
    if (!isCustom && !enteredKey) {
      setFeedback(`Please enter an API key for ${provider.name}`);
      return;
    }
    if (isCustom && !enteredKey && !enteredBaseUrl) {
      setFeedback(`Please enter an API key or Base URL for ${provider.name}`);
      return;
    }
    setIsSaving((prev) => ({ ...prev, [provider.id]: true }));
    setFeedback(null);

    try {
      const enteredBaseUrl = baseUrlInputs[provider.id]?.trim();
      const res = await fetch("/api/llm/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: provider.id,
          apiKey: enteredKey || "",
          baseUrl: enteredBaseUrl || undefined,
        }),
      });

      if (res.ok) {
        setKeyInputs((prev) => ({ ...prev, [provider.id]: "" }));
        setTestResults((prev) => {
          const next = { ...prev };
          delete next[provider.id];
          return next;
        });
        await fetchProviders();
        setFeedback(
          isCustom && !enteredKey
            ? `Saved configuration for ${provider.name}`
            : `Saved API key for ${provider.name}`,
        );
      } else {
        const errData = (await res.json()) as { error?: string };
        setFeedback(errData.error || "Failed to save key");
      }
    } catch {
      setFeedback("Network error saving key");
    } finally {
      setIsSaving((prev) => ({ ...prev, [provider.id]: false }));
    }
  };

  const handleRemoveKey = async (provider: EnrichedProviderMeta) => {
    setIsRemoving((prev) => ({ ...prev, [provider.id]: true }));
    setFeedback(null);

    try {
      const res = await fetch(`/api/llm/keys/${provider.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setKeyInputs((prev) => ({ ...prev, [provider.id]: "" }));
        setBaseUrlInputs((prev) => ({ ...prev, [provider.id]: "" }));
        setTestResults((prev) => {
          const next = { ...prev };
          delete next[provider.id];
          return next;
        });
        await fetchProviders();
        setFeedback(`Removed key for ${provider.name}`);
      } else {
        const errData = (await res.json()) as { error?: string };
        setFeedback(errData.error || "Failed to remove key");
      }
    } catch {
      setFeedback("Network error removing key");
    } finally {
      setIsRemoving((prev) => ({ ...prev, [provider.id]: false }));
    }
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop click dismisses modal overlay
    <div
      className="modal-backdrop"
      data-testid="api-key-modal"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal-dialog api-key-modal"
        // biome-ignore lint/a11y/useSemanticElements: Modal wrapper styled with custom flex layout
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-modal-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge">BYOK</span>
            <h2 id="api-key-modal-title" className="modal-title">
              API Key Management
            </h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            data-testid="api-key-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </header>

        <p className="modal-description">
          Configure bring-your-own-key credentials stored securely in memory for
          this studio session.
        </p>

        {feedback && <output className="modal-alert-banner">{feedback}</output>}

        <div className="api-key-providers-list">
          {providers.length === 0 ? (
            <p className="empty-text">No providers available</p>
          ) : (
            providers.map((p) => {
              const isConfigured = p.status?.configured ?? false;
              const maskedKey = p.status?.maskedKey;
              const testResult = testResults[p.id];

              return (
                <div
                  key={p.id}
                  className="provider-key-card"
                  data-testid={`provider-card-${p.id}`}
                >
                  <div className="provider-card-header">
                    <div className="provider-name-group">
                      <h4 className="provider-name">{p.name}</h4>
                      <span className="provider-id-badge">{p.id}</span>
                    </div>
                    <span
                      className={`status-pill ${isConfigured ? "configured" : "unconfigured"}`}
                    >
                      {isConfigured
                        ? `Active (${maskedKey})`
                        : "Not Configured"}
                    </span>
                  </div>

                  <div className="provider-input-fields">
                    <div className="input-group">
                      <label
                        htmlFor={`key-input-${p.id}`}
                        className="field-label"
                      >
                        API Key
                      </label>
                      <input
                        id={`key-input-${p.id}`}
                        type="password"
                        className="modal-text-input"
                        data-testid={`key-input-${p.id}`}
                        placeholder={
                          p.id === "custom"
                            ? isConfigured
                              ? "Optional (enter new key to replace)..."
                              : "Optional (leave empty for local Ollama/vLLM)"
                            : isConfigured
                              ? "Enter new key to replace..."
                              : "sk-..."
                        }
                        onChange={(e) =>
                          setKeyInputs((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                        autoComplete="off"
                      />
                    </div>

                    {p.supportsCustomBaseUrl && (
                      <div className="input-group">
                        <label
                          htmlFor={`baseurl-input-${p.id}`}
                          className="field-label"
                        >
                          Custom Base URL (optional)
                        </label>
                        <input
                          id={`baseurl-input-${p.id}`}
                          type="url"
                          className="modal-text-input"
                          data-testid={`baseurl-input-${p.id}`}
                          placeholder={
                            p.id === "custom"
                              ? "http://localhost:11434/v1"
                              : p.defaultBaseUrl || "https://api.example.com/v1"
                          }
                          value={baseUrlInputs[p.id] || ""}
                          onChange={(e) =>
                            setBaseUrlInputs((prev) => ({
                              ...prev,
                              [p.id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    )}
                  </div>

                  {testResult && (
                    <div
                      className={`test-result-indicator ${testResult.success ? "success" : "error"}`}
                      data-testid={`test-result-${p.id}`}
                    >
                      {testResult.success
                        ? `✓ Connection verified (${testResult.latencyMs}ms)`
                        : `✕ Error: ${testResult.error || "Connection failed"}`}
                    </div>
                  )}

                  <div className="provider-card-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      data-testid={`test-btn-${p.id}`}
                      disabled={isTesting[p.id]}
                      onClick={() => handleTestConnection(p)}
                    >
                      {isTesting[p.id] ? "Testing..." : "Test Connection"}
                    </button>

                    <button
                      type="button"
                      className="btn-primary"
                      data-testid={`save-btn-${p.id}`}
                      disabled={
                        isSaving[p.id] ||
                        (p.id === "custom"
                          ? !keyInputs[p.id]?.trim() &&
                            !baseUrlInputs[p.id]?.trim()
                          : !keyInputs[p.id]?.trim())
                      }
                      onClick={() => handleSaveKey(p)}
                    >
                      {isSaving[p.id]
                        ? "Saving..."
                        : p.id === "custom"
                          ? "Save"
                          : "Save Key"}
                    </button>

                    {isConfigured && (
                      <button
                        type="button"
                        className="btn-danger-outline"
                        data-testid={`remove-btn-${p.id}`}
                        disabled={isRemoving[p.id]}
                        onClick={() => handleRemoveKey(p)}
                      >
                        {isRemoving[p.id] ? "Removing..." : "Remove Key"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <footer className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            data-testid="api-key-modal-done"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
