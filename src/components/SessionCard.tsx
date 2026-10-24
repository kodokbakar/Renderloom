import type { SessionSummary } from "../domain/session";

export interface SessionCardProps {
  session: SessionSummary;
  onOpen: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  className?: string;
}

export function SessionCard({
  session,
  onOpen,
  onDelete,
  className = "",
}: SessionCardProps) {
  const formattedDate = session.updatedAt
    ? new Date(session.updatedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const count = session.candidateCount ?? 0;

  return (
    <article
      className={`session-card ${className}`.trim()}
      data-testid="session-card"
      data-session-id={session.id}
    >
      <header className="session-card-header">
        <h3 className="session-card-title" title={session.name}>
          {session.name}
        </h3>
        <span className="session-card-slug" title="Slug">
          {session.slug}
        </span>
      </header>

      <div className="session-card-chips">
        <span className="card-chip style-chip" title="Style Preset">
          {session.styleId}
        </span>
        <span className="card-chip dims-chip" title="Dimensions">
          {session.dimensions.width}×{session.dimensions.height}
        </span>
        <span className="card-chip provider-chip" title="Provider & Model">
          {session.providerId}/{session.modelId}
        </span>
        <span className="card-chip count-chip" title="Candidate Count">
          {count} {count === 1 ? "candidate" : "candidates"}
        </span>
      </div>

      <footer className="session-card-footer">
        <time className="session-card-updated" title="Last Updated">
          {formattedDate}
        </time>
        <div className="session-card-actions">
          <button
            type="button"
            className="btn-card-delete"
            data-testid="delete-session-btn"
            onClick={() => onDelete(session.id)}
            aria-label={`Delete ${session.name}`}
          >
            Delete
          </button>
          <button
            type="button"
            className="btn-card-open"
            data-testid="open-studio-btn"
            onClick={() => onOpen(session.id)}
          >
            Open Studio →
          </button>
        </div>
      </footer>
    </article>
  );
}
