import { useMemo, useState } from "react";
import type { SessionSummary } from "../domain/session";
import { SessionCard } from "./SessionCard";

export interface WorkspaceDashboardProps {
  sessions: SessionSummary[];
  onOpenSession: (sessionId: string) => void;
  onNewSession: () => void;
  onOpenApiKeys: () => void;
  onDeleteSession: (sessionId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function WorkspaceDashboard({
  sessions,
  onOpenSession,
  onNewSession,
  onOpenApiKeys,
  onDeleteSession,
  isLoading = false,
  className = "",
}: WorkspaceDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("all");

  // Distinct styles for filter dropdown
  const availableStyles = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      if (s.styleId) set.add(s.styleId);
    }
    return Array.from(set).sort();
  }, [sessions]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((s) => {
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q);
      const matchesStyle =
        selectedStyle === "all" || s.styleId === selectedStyle;
      return matchesSearch && matchesStyle;
    });
  }, [sessions, searchQuery, selectedStyle]);

  // Metrics
  const totalSessions = sessions.length;
  const totalCandidates = useMemo(
    () => sessions.reduce((acc, s) => acc + (s.candidateCount ?? 0), 0),
    [sessions],
  );
  const activeStyleCount = availableStyles.length;

  return (
    <div className={`dashboard-container ${className}`.trim()}>
      {/* Top Bar */}
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <span className="brand-badge">STUDIO</span>
          <h1 className="brand-title">Renderloom</h1>
          <span className="brand-tagline">Workspace Dashboard</span>
        </div>

        <div className="dashboard-header-actions">
          <button
            type="button"
            className="btn-header-secondary"
            data-testid="open-api-keys-btn"
            onClick={onOpenApiKeys}
          >
            API Keys
          </button>
          <button
            type="button"
            className="btn-header-primary"
            data-testid="new-session-btn"
            onClick={onNewSession}
          >
            + New Session
          </button>
        </div>
      </header>

      {/* Metrics Row */}
      <section className="dashboard-metrics" aria-label="Workspace Metrics">
        <div className="metric-card" data-testid="metric-total-sessions">
          <span className="metric-label">Total Sessions</span>
          <span className="metric-value">{totalSessions}</span>
        </div>
        <div className="metric-card" data-testid="metric-total-candidates">
          <span className="metric-label">Candidates Drafted</span>
          <span className="metric-value">{totalCandidates}</span>
        </div>
        <div className="metric-card" data-testid="metric-active-styles">
          <span className="metric-label">Active Styles</span>
          <span className="metric-value">{activeStyleCount}</span>
        </div>
      </section>

      {/* Filter & Search Bar */}
      <section className="dashboard-filter-bar" aria-label="Filter Sessions">
        <div className="search-input-wrapper">
          <input
            type="search"
            className="search-input"
            data-testid="session-search-input"
            placeholder="Search sessions by name or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search sessions"
          />
        </div>

        <div className="filter-select-wrapper">
          <label htmlFor="style-filter-select" className="sr-only">
            Filter by Style
          </label>
          <select
            id="style-filter-select"
            className="style-select"
            data-testid="style-filter-select"
            value={selectedStyle}
            onChange={(e) => setSelectedStyle(e.target.value)}
          >
            <option value="all">All Styles</option>
            {availableStyles.map((style) => (
              <option key={style} value={style}>
                {style}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Session Grid or Empty State */}
      <main className="dashboard-main">
        {isLoading ? (
          <div className="dashboard-loading" data-testid="dashboard-loading">
            Loading sessions...
          </div>
        ) : filteredSessions.length > 0 ? (
          <div className="session-grid" data-testid="session-grid">
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onOpen={onOpenSession}
                onDelete={onDeleteSession}
              />
            ))}
          </div>
        ) : (
          <div
            className="dashboard-empty-state"
            data-testid="dashboard-empty-state"
          >
            <div className="empty-icon">◻</div>
            <h3 className="empty-title">
              {sessions.length === 0
                ? "No sessions yet"
                : "No matching sessions"}
            </h3>
            <p className="empty-desc">
              {sessions.length === 0
                ? "Create your first studio session to start designing vector layouts."
                : `No sessions found matching "${searchQuery}".`}
            </p>
            {sessions.length === 0 && (
              <button
                type="button"
                className="btn-primary"
                onClick={onNewSession}
              >
                + Create Session
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
