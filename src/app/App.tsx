import { useEffect, useState } from "react";
import "./App.css";
import { ApiKeyModal } from "../components/ApiKeyModal";
import { BatchProgressIndicator } from "../components/BatchProgressIndicator";
import { CandidateGallery } from "../components/CandidateGallery";
import { GenerationSettingsBar } from "../components/GenerationSettingsBar";
import { NewSessionModal } from "../components/NewSessionModal";
import { PreviewModal } from "../components/PreviewModal";
import { StudioControls } from "../components/StudioControls";
import { WorkspaceDashboard } from "../components/WorkspaceDashboard";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { buildArtifactUrl } from "../components/utils/artifact-url";
import type { Candidate } from "../domain/candidate";
import type {
  CreateSessionRequest,
  GenerationRequest,
} from "../domain/request";
import type { FullSession, Session, SessionSummary } from "../domain/session";
import type { Version } from "../domain/version";

export interface AppProps {
  initialFullSession?: FullSession;
  initialSessions?: SessionSummary[];
  initialSelectedCandidateId?: string;
  initialView?: "dashboard" | "studio";
}

function resolveInitialView(
  initialView?: "dashboard" | "studio",
  initialFullSession?: FullSession,
): "dashboard" | "studio" {
  if (initialView) return initialView;
  if (initialFullSession) return "studio";

  if (typeof window !== "undefined") {
    const hash = window.location.hash;
    const search = window.location.search;
    if (
      hash.startsWith("#/studio") ||
      search.includes("view=studio") ||
      search.includes("session=")
    ) {
      return "studio";
    }
    if (hash === "#/dashboard" || search.includes("view=dashboard")) {
      return "dashboard";
    }
  }

  return "dashboard";
}

export function App({
  initialFullSession,
  initialSessions,
  initialSelectedCandidateId,
  initialView,
}: AppProps = {}) {
  const [activeView, setActiveView] = useState<"dashboard" | "studio">(() =>
    resolveInitialView(initialView, initialFullSession),
  );
  const [sessions, setSessions] = useState<SessionSummary[]>(
    initialSessions || [],
  );
  const [fullSession, setFullSession] = useState<FullSession | null>(
    initialFullSession || null,
  );
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    initialSelectedCandidateId || null,
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [sourceCache, setSourceCache] = useState<
    Record<string, { jsx?: string; svg?: string }>
  >({});
  const [isRevising, setIsRevising] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const session = fullSession?.session;
  const candidates: Candidate[] = session?.candidates || [];
  const selectedCandidate =
    candidates.find((c) => c.id === selectedCandidateId) ||
    candidates[0] ||
    null;

  // Selected index and pagination
  const selectedIndex = selectedCandidate
    ? candidates.findIndex((c) => c.id === selectedCandidate.id)
    : -1;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex !== -1 && selectedIndex < candidates.length - 1;

  // 1. Initial data fetching if not passed via props
  useEffect(() => {
    let mounted = true;
    async function loadInitialData() {
      if (initialSessions && initialSessions.length > 0) return;
      setIsLoadingSessions(true);
      try {
        const res = await fetch("/api/sessions");
        if (!res.ok) return;
        const data = (await res.json()) as { sessions: SessionSummary[] };
        if (!mounted) return;
        setSessions(data.sessions || []);

        // If in studio view or hash requested studio, load first session if none loaded
        if (!fullSession) {
          const hash =
            typeof window !== "undefined" ? window.location.hash : "";
          const sessionParamMatch = hash.match(/session=([^&]+)/);
          const targetSessionId =
            sessionParamMatch?.[1] || data.sessions?.[0]?.id;

          if (targetSessionId) {
            const detailRes = await fetch(`/api/sessions/${targetSessionId}`);
            if (detailRes.ok && mounted) {
              const sessionData = (await detailRes.json()) as FullSession;
              setFullSession(sessionData);
              const firstCand = sessionData.session?.candidates?.[0];
              if (firstCand) {
                setSelectedCandidateId(firstCand.id);
              }
            }
          }
        }
      } catch {
        // Handled silently in offline tests
      } finally {
        if (mounted) setIsLoadingSessions(false);
      }
    }

    loadInitialData();
    return () => {
      mounted = false;
    };
  }, [initialSessions, fullSession]);

  // 2. Hash Change & Browser Navigation Listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#/studio")) {
        setActiveView("studio");
        const match = hash.match(/session=([^&]+)/);
        if (match?.[1] && match[1] !== fullSession?.session?.id) {
          handleSelectSession(match[1]);
        }
      } else if (hash === "#/dashboard" || hash === "" || hash === "#/") {
        if (hash === "#/dashboard") {
          setActiveView("dashboard");
        }
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [fullSession?.session?.id]);

  // 3. Fetch JSX/SVG source when candidate is inspected or modal opened
  useEffect(() => {
    if (!isPreviewOpen || !selectedCandidate || !session) return;
    const sessionId = session.id;
    const candId = selectedCandidate.id;
    if (sourceCache[candId]?.jsx && sourceCache[candId]?.svg) return;

    let mounted = true;
    async function fetchSources() {
      setIsLoadingSource(true);
      let jsx: string | undefined = sourceCache[candId]?.jsx;
      let svg: string | undefined = sourceCache[candId]?.svg;

      try {
        if (!jsx && selectedCandidate?.artifacts?.sourcePath) {
          const filename = selectedCandidate.artifacts.sourcePath
            .split("/")
            .pop();
          if (filename) {
            const url = buildArtifactUrl(sessionId, "source", filename);
            const res = await fetch(url);
            if (res.ok) jsx = await res.text();
          }
        }

        if (!svg && selectedCandidate?.artifacts?.svgPath) {
          const filename = selectedCandidate.artifacts.svgPath.split("/").pop();
          if (filename) {
            const url = buildArtifactUrl(sessionId, "svg", filename);
            const res = await fetch(url);
            if (res.ok) svg = await res.text();
          }
        }

        if (mounted) {
          setSourceCache((prev) => ({
            ...prev,
            [candId]: { jsx, svg },
          }));
        }
      } catch {
        // Fallback handled gracefully
      } finally {
        if (mounted) setIsLoadingSource(false);
      }
    }

    fetchSources();
    return () => {
      mounted = false;
    };
  }, [isPreviewOpen, selectedCandidate, session, sourceCache]);

  // 4. Desktop Keyboard Navigation when modal is closed
  useEffect(() => {
    if (isPreviewOpen || activeView !== "studio") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (candidates.length === 0) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextIdx =
          selectedIndex < candidates.length - 1 ? selectedIndex + 1 : 0;
        const nextCand = candidates[nextIdx];
        if (nextCand) setSelectedCandidateId(nextCand.id);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prevIdx =
          selectedIndex > 0 ? selectedIndex - 1 : candidates.length - 1;
        const prevCand = candidates[prevIdx];
        if (prevCand) setSelectedCandidateId(prevCand.id);
      } else if (e.key === "Enter" && selectedCandidate) {
        e.preventDefault();
        setIsPreviewOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPreviewOpen, activeView, candidates, selectedIndex, selectedCandidate]);

  const handleSelectSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (res.ok) {
        const data = (await res.json()) as FullSession;
        setFullSession(data);
        const firstCand = data.session?.candidates?.[0];
        setSelectedCandidateId(firstCand ? firstCand.id : null);
        setIsPreviewOpen(false);
        if (typeof window !== "undefined") {
          window.location.hash = `#/studio?session=${sessionId}`;
        }
        setActiveView("studio");
      }
    } catch {
      // Offline fallback
    }
  };

  const handleNavigateDashboard = () => {
    if (typeof window !== "undefined") {
      window.location.hash = "#/dashboard";
    }
    setActiveView("dashboard");
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (fullSession?.session?.id === sessionId) {
          setFullSession(null);
          setSelectedCandidateId(null);
          handleNavigateDashboard();
        }
      }
    } catch {
      // Offline fallback
    }
  };

  const handleCreateSession = async (payload: CreateSessionRequest) => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = (await res.json()) as { error?: string };
      throw new Error(errData.error || "Failed to create session");
    }

    const { session: newSession } = (await res.json()) as { session: Session };

    // Refresh session summaries list
    try {
      const listRes = await fetch("/api/sessions");
      if (listRes.ok) {
        const data = (await listRes.json()) as { sessions: SessionSummary[] };
        setSessions(data.sessions || []);
      }
    } catch {}

    // Open created session in Studio
    try {
      const detailRes = await fetch(`/api/sessions/${newSession.id}`);
      if (detailRes.ok) {
        const full = (await detailRes.json()) as FullSession;
        setFullSession(full);
        const firstCand = full.session?.candidates?.[0];
        setSelectedCandidateId(firstCand ? firstCand.id : null);
      } else {
        setFullSession({
          session: newSession,
          conversation: {
            sessionId: newSession.id,
            messages: [],
            updatedAt: newSession.updatedAt,
          },
          promptSnapshot: payload.initialPrompt || "",
          generationConfig: {
            providerId: newSession.providerId,
            modelId: newSession.modelId,
            styleId: newSession.styleId,
            candidateCount: 4,
            width: newSession.dimensions.width,
            height: newSession.dimensions.height,
            outputFormat: "png",
            createdAt: newSession.createdAt,
          },
          artifacts: { images: [], source: [], svg: [], assets: [] },
        });
      }
    } catch {
      // Fallback
    }

    if (typeof window !== "undefined") {
      window.location.hash = `#/studio?session=${newSession.id}`;
    }
    setActiveView("studio");
  };

  const handleGenerate = async (payload: GenerationRequest) => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setIsGenerating(false);
        const errData = (await res.json()) as { error?: string };
        throw new Error(errData.error || "Generation request failed");
      }

      const data = (await res.json()) as {
        batchId: string;
        sessionId: string;
        status: string;
        candidates: Candidate[];
      };

      // Set placeholder candidates and activeBatchId
      setFullSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          session: {
            ...prev.session,
            activeBatchId: data.batchId,
            lastBatchStatus: data.status,
            candidates: data.candidates || prev.session.candidates,
          },
        };
      });

      // Connect SSE stream
      if (
        typeof window !== "undefined" &&
        typeof window.EventSource !== "undefined"
      ) {
        const es = new EventSource(`/api/generations/${data.batchId}/events`);

        es.addEventListener("snapshot", (e) => {
          try {
            const snapshot = JSON.parse(e.data);
            if (snapshot.candidates) {
              setFullSession((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  session: {
                    ...prev.session,
                    lastBatchStatus:
                      snapshot.status || prev.session.lastBatchStatus,
                    candidates: snapshot.candidates,
                  },
                };
              });
            }
          } catch {}
        });

        es.addEventListener("candidate_update", (e) => {
          try {
            const updated = JSON.parse(e.data) as Candidate;
            setFullSession((prev) => {
              if (!prev) return prev;
              const existing = prev.session.candidates || [];
              const updatedList = existing.map((c) =>
                c.id === updated.id ? updated : c,
              );
              return {
                ...prev,
                session: {
                  ...prev.session,
                  candidates: updatedList,
                },
              };
            });
          } catch {}
        });

        es.addEventListener("batch_completed", (e) => {
          try {
            const completed = JSON.parse(e.data);
            setFullSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                session: {
                  ...prev.session,
                  lastBatchStatus: completed.status || "completed",
                  candidates: completed.candidates || prev.session.candidates,
                },
              };
            });
          } catch {
          } finally {
            es.close();
            setIsGenerating(false);
          }
        });

        es.onerror = () => {
          es.close();
          setIsGenerating(false);
        };
      } else {
        setIsGenerating(false);
      }
    } catch (err: unknown) {
      setIsGenerating(false);
      throw err;
    }
  };

  const handleSelectCandidate = (cand: Candidate) => {
    setSelectedCandidateId(cand.id);
  };

  const handleInspectCandidate = (cand: Candidate) => {
    setSelectedCandidateId(cand.id);
    setIsPreviewOpen(true);
  };

  const handlePrevCandidate = () => {
    if (hasPrev) {
      const prev = candidates[selectedIndex - 1];
      if (prev) setSelectedCandidateId(prev.id);
    }
  };

  const handleNextCandidate = () => {
    if (hasNext) {
      const next = candidates[selectedIndex + 1];
      if (next) setSelectedCandidateId(next.id);
    }
  };

  const handleRetryCandidate = async (candidateId: string) => {
    if (!session?.activeBatchId) return;
    try {
      const res = await fetch(
        `/api/generations/${session.activeBatchId}/candidates/${candidateId}/retry`,
        { method: "POST" },
      );
      if (res.ok) {
        const { candidate: retried } = (await res.json()) as {
          candidate: Candidate;
        };
        setFullSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            session: {
              ...prev.session,
              candidates: prev.session.candidates?.map((c) =>
                c.id === retried.id ? retried : c,
              ),
            },
          };
        });
      }
    } catch {
      // Offline fallback
    }
  };

  const handleCancelBatch = async (batchId: string) => {
    try {
      await fetch(`/api/generations/${batchId}/cancel`, { method: "POST" });
      setIsGenerating(false);
      setFullSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          session: {
            ...prev.session,
            lastBatchStatus: "cancelled",
            candidates: prev.session.candidates?.map((c) =>
              c.state === "generating" ||
              c.state === "validating" ||
              c.state === "rendering" ||
              c.state === "queued"
                ? { ...c, state: "cancelled" }
                : c,
            ),
          },
        };
      });
    } catch {
      // Offline fallback
    }
  };

  const handleReviseCandidate = async (
    candidateId: string,
    prompt: string,
    parentVersionId?: string,
  ) => {
    if (!session) return;
    setIsRevising(true);
    try {
      const res = await fetch(
        `/api/sessions/${session.id}/candidates/${candidateId}/revisions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, parentVersionId }),
        },
      );
      if (res.ok) {
        const { candidate: revised } = (await res.json()) as {
          candidate: Candidate;
          version: Version;
        };
        setSourceCache((prev) => {
          const next = { ...prev };
          delete next[candidateId];
          return next;
        });
        setFullSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            session: {
              ...prev.session,
              candidates: prev.session.candidates?.map((c) =>
                c.id === revised.id ? revised : c,
              ),
            },
          };
        });
      } else {
        try {
          const sessRes = await fetch(`/api/sessions/${session.id}`);
          if (sessRes.ok) {
            const data = (await sessRes.json()) as FullSession;
            setFullSession(data);
          }
        } catch {
          // Offline fallback
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setIsRevising(false);
    }
  };

  const handleRestoreVersion = async (
    candidateId: string,
    versionId: string,
  ) => {
    if (!session) return;
    setIsRestoring(true);
    try {
      const res = await fetch(
        `/api/sessions/${session.id}/candidates/${candidateId}/versions/${versionId}/restore`,
        { method: "POST" },
      );
      if (res.ok) {
        const { candidate: restored } = (await res.json()) as {
          candidate: Candidate;
          restoredVersion: Version;
        };
        setSourceCache((prev) => {
          const next = { ...prev };
          delete next[candidateId];
          return next;
        });
        setFullSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            session: {
              ...prev.session,
              candidates: prev.session.candidates?.map((c) =>
                c.id === restored.id ? restored : c,
              ),
            },
          };
        });
      }
    } catch {
      // Offline fallback
    } finally {
      setIsRestoring(false);
    }
  };

  const fallbackSession: Session = session || {
    id: "default-session",
    name: "Renderloom Workspace",
    slug: "renderloom-workspace",
    providerId: "default",
    modelId: "default",
    styleId: "default",
    dimensions: { width: 1024, height: 1024 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const activeSources = selectedCandidate
    ? sourceCache[selectedCandidate.id]
    : undefined;

  return (
    <div className="renderloom-app">
      {activeView === "dashboard" ? (
        <WorkspaceDashboard
          sessions={sessions}
          onOpenSession={handleSelectSession}
          onNewSession={() => setIsNewSessionModalOpen(true)}
          onOpenApiKeys={() => setIsApiKeyModalOpen(true)}
          onDeleteSession={handleDeleteSession}
          isLoading={isLoadingSessions}
        />
      ) : (
        <div className="studio-container">
          <WorkspaceHeader
            session={fallbackSession}
            sessions={sessions}
            onSelectSession={handleSelectSession}
            onNavigateDashboard={handleNavigateDashboard}
            onOpenApiKeys={() => setIsApiKeyModalOpen(true)}
            promptSnapshot={fullSession?.promptSnapshot}
          />

          <GenerationSettingsBar
            session={fallbackSession}
            generationConfig={fullSession?.generationConfig}
          />

          <StudioControls
            session={fallbackSession}
            generationConfig={fullSession?.generationConfig}
            isGenerating={
              isGenerating || session?.lastBatchStatus === "running"
            }
            onGenerate={handleGenerate}
          />

          <main className="workspace-main">
            <BatchProgressIndicator
              batchId={session?.activeBatchId}
              status={session?.lastBatchStatus}
              candidates={candidates}
              onCancelBatch={handleCancelBatch}
            />

            <CandidateGallery
              sessionId={fallbackSession.id}
              candidates={candidates}
              selectedCandidateId={selectedCandidateId || undefined}
              onSelectCandidate={handleSelectCandidate}
              onInspectCandidate={handleInspectCandidate}
              onRetryCandidate={handleRetryCandidate}
              isGenerating={
                isGenerating || session?.lastBatchStatus === "running"
              }
            />
          </main>

          <PreviewModal
            isOpen={isPreviewOpen}
            sessionId={fallbackSession.id}
            candidate={selectedCandidate}
            session={session}
            onClose={() => setIsPreviewOpen(false)}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrevCandidate={handlePrevCandidate}
            onNextCandidate={handleNextCandidate}
            onRetry={handleRetryCandidate}
            jsxSource={activeSources?.jsx}
            svgSource={activeSources?.svg}
            isLoadingSource={isLoadingSource}
            onRevise={handleReviseCandidate}
            onRestoreVersion={handleRestoreVersion}
            isRevising={isRevising}
            isRestoring={isRestoring}
          />
        </div>
      )}

      {/* Global Modals */}
      <NewSessionModal
        isOpen={isNewSessionModalOpen}
        onClose={() => setIsNewSessionModalOpen(false)}
        onCreate={handleCreateSession}
      />

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />
    </div>
  );
}
