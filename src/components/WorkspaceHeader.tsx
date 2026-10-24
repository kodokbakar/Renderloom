import { useState } from "react";
import type { Session, SessionSummary } from "../domain/session";

export interface WorkspaceHeaderProps {
  session: Session;
  sessions?: SessionSummary[];
  onSelectSession?: (sessionId: string) => void;
  promptSnapshot?: string;
  className?: string;
}

export function WorkspaceHeader({
  session,
  sessions,
  onSelectSession,
  promptSnapshot,
  className = "",
}: WorkspaceHeaderProps) {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <header className={`workspace-header ${className}`.trim()}>
      <div className="workspace-header-primary">
        <div className="workspace-brand">
          <h1 className="brand-title">Renderloom</h1>
          <span className="brand-tagline">Review Workspace</span>
        </div>

        <div className="workspace-session-info">
          <div className="session-title-group">
            <h2 className="session-name" title={session.name}>
              {session.name}
            </h2>
            <span className="session-slug-badge" title="Session Slug">
              {session.slug}
            </span>
          </div>

          {sessions && sessions.length > 0 && onSelectSession && (
            <div className="session-selector-container">
              <label htmlFor="session-select" className="sr-only">
                Switch Session
              </label>
              <select
                id="session-select"
                className="session-select"
                value={session.id}
                onChange={(e) => onSelectSession(e.target.value)}
                aria-label="Switch Session"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.slug})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {promptSnapshot && (
          <div className="workspace-header-actions">
            <button
              type="button"
              className={`btn-toggle-prompt ${showPrompt ? "active" : ""}`}
              onClick={() => setShowPrompt(!showPrompt)}
              aria-expanded={showPrompt}
              aria-controls="workspace-prompt-drawer"
            >
              {showPrompt ? "Hide Prompt" : "View Prompt"}
            </button>
          </div>
        )}
      </div>

      {promptSnapshot && showPrompt && (
        <section
          id="workspace-prompt-drawer"
          className="workspace-prompt-drawer"
          aria-label="Session Prompt"
        >
          <div className="prompt-drawer-header">
            <span className="prompt-drawer-label">Original Prompt:</span>
          </div>
          <p className="prompt-drawer-content">{promptSnapshot}</p>
        </section>
      )}
    </header>
  );
}
