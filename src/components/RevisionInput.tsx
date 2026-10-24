import { useState } from "react";

export interface RevisionInputProps {
  candidateId: string;
  parentVersionId?: string;
  disabled?: boolean;
  isSubmitting?: boolean;
  onSubmit: (prompt: string) => Promise<void> | void;
  className?: string;
}

export function RevisionInput({
  candidateId,
  parentVersionId = "v1",
  disabled = false,
  isSubmitting = false,
  onSubmit,
  className = "",
}: RevisionInputProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || isSubmitting || disabled) return;
    await onSubmit(trimmed);
    setPrompt("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isButtonDisabled = disabled || isSubmitting || !prompt.trim();

  return (
    <div className={`revision-input-section ${className}`.trim()}>
      <div className="revision-input-header">
        <h4 className="revision-input-title">Design Revision</h4>
        <span className="revision-parent-badge monospace">
          Parent: {parentVersionId}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="revision-input-form">
        <textarea
          className="revision-input-textarea"
          placeholder="Describe your design revision (e.g., 'Make hero heading bolder, switch background to obsidian, add 32px padding')... (⌘+Enter)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSubmitting}
          rows={3}
          maxLength={1000}
          aria-label="Revision prompt"
        />

        <div className="revision-input-footer">
          <span className="revision-char-count">{prompt.length} / 1000</span>
          <button
            type="submit"
            className="btn btn-primary revision-apply-btn"
            disabled={isButtonDisabled}
          >
            {isSubmitting ? (
              <>
                <span className="spinner-sm" aria-hidden="true" />
                <span>Revising...</span>
              </>
            ) : (
              <span>Apply Revision</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
