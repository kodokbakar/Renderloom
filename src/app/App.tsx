import { useEffect, useState } from "react";
import "./App.css";
import { BatchProgressIndicator } from "../components/BatchProgressIndicator";
import { CandidateGallery } from "../components/CandidateGallery";
import { GenerationSettingsBar } from "../components/GenerationSettingsBar";
import { PreviewModal } from "../components/PreviewModal";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { buildArtifactUrl } from "../components/utils/artifact-url";
import type { Candidate } from "../domain/candidate";
import type { FullSession, Session, SessionSummary } from "../domain/session";

export interface AppProps {
  initialFullSession?: FullSession;
  initialSessions?: SessionSummary[];
  initialSelectedCandidateId?: string;
}

export function App({
  initialFullSession,
  initialSessions,
  initialSelectedCandidateId,
}: AppProps = {}) {
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
  const [sourceCache, setSourceCache] = useState<
    Record<string, { jsx?: string; svg?: string }>
  >({});

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
    if (fullSession) return;

    let mounted = true;
    async function loadInitialData() {
      try {
        const res = await fetch("/api/sessions");
        if (!res.ok) return;
        const data = (await res.json()) as { sessions: SessionSummary[] };
        if (!mounted) return;
        setSessions(data.sessions || []);

        const firstSession = data.sessions?.[0];
        if (firstSession) {
          const detailRes = await fetch(`/api/sessions/${firstSession.id}`);
          if (detailRes.ok && mounted) {
            const sessionData = (await detailRes.json()) as FullSession;
            setFullSession(sessionData);
            const firstCand = sessionData.session?.candidates?.[0];
            if (firstCand) {
              setSelectedCandidateId(firstCand.id);
            }
          }
        }
      } catch {
        // Handled silently or network offline in tests
      }
    }

    loadInitialData();
    return () => {
      mounted = false;
    };
  }, [fullSession]);

  // 2. Fetch JSX/SVG source when candidate is inspected or modal opened
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

  // 3. Desktop Keyboard Navigation when modal is closed
  useEffect(() => {
    if (isPreviewOpen) return;

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
  }, [isPreviewOpen, candidates, selectedIndex, selectedCandidate]);

  const handleSelectSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (res.ok) {
        const data = (await res.json()) as FullSession;
        setFullSession(data);
        const firstCand = data.session?.candidates?.[0];
        setSelectedCandidateId(firstCand ? firstCand.id : null);
        setIsPreviewOpen(false);
      }
    } catch {
      // Offline fallback
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
    <div className="studio-container">
      <WorkspaceHeader
        session={fallbackSession}
        sessions={sessions}
        onSelectSession={handleSelectSession}
        promptSnapshot={fullSession?.promptSnapshot}
      />

      <GenerationSettingsBar
        session={fallbackSession}
        generationConfig={fullSession?.generationConfig}
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
          isGenerating={session?.lastBatchStatus === "running"}
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
      />
    </div>
  );
}
