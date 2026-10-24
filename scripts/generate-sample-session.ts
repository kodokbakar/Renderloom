import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Candidate, Version } from "../src/domain";
import { render } from "../src/renderer/render";
import { SessionService } from "../src/sessions/service";

const SAMPLE_JSX_CANDIDATE_1_V1 = `<div
  style={{
    display: 'flex',
    flexDirection: 'column',
    width: '1200px',
    height: '1200px',
    backgroundColor: '#F5F5F0',
    color: '#111111',
    padding: '48px',
    justifyContent: 'space-between',
    fontFamily: 'sans-serif',
  }}
>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '6px solid #111111', paddingBottom: '24px' }}>
    <span style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '4px' }}>BAUHAUS DESSAU</span>
    <span style={{ fontSize: '20px', fontWeight: 400 }}>1926 — 2026</span>
  </div>
  <div style={{ display: 'flex', flex: 1, marginTop: '36px', marginBottom: '36px', gap: '32px' }}>
    <div style={{ display: 'flex', flex: 1, backgroundColor: '#D02020', padding: '32px', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <span style={{ fontSize: '72px', fontWeight: 800, color: '#F5F5F0', lineHeight: 1 }}>FORM</span>
      <span style={{ fontSize: '72px', fontWeight: 800, color: '#F5F5F0', lineHeight: 1 }}>FOLLOWS</span>
      <span style={{ fontSize: '72px', fontWeight: 800, color: '#F5F5F0', lineHeight: 1 }}>FUNCTION</span>
    </div>
    <div style={{ display: 'flex', width: '360px', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', height: '240px', backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="120" height="120" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="#FBBF24" />
        </svg>
      </div>
      <div style={{ display: 'flex', flex: 1, backgroundColor: '#111111', padding: '24px', flexDirection: 'column', justifyContent: 'center' }}>
        <p style={{ color: '#F5F5F0', fontSize: '18px', margin: 0, lineHeight: 1.5 }}>
          Modernist German movement emphasizing primary colors, bold geometric forms, functional hierarchy, and asymmetric balance.
        </p>
      </div>
    </div>
  </div>
  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '4px solid #111111', paddingTop: '16px' }}>
    <span style={{ fontSize: '16px', fontWeight: 700 }}>RENDERLOOM DESIGN LABS</span>
    <span style={{ fontSize: '16px' }}>EXHIBITION SERIES NO. 01</span>
  </div>
</div>`;

const SAMPLE_JSX_CANDIDATE_1_V2 = `<div
  style={{
    display: 'flex',
    flexDirection: 'column',
    width: '1200px',
    height: '1200px',
    backgroundColor: '#F5F5F0',
    color: '#111111',
    padding: '48px',
    justifyContent: 'space-between',
    fontFamily: 'sans-serif',
  }}
>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '6px solid #111111', paddingBottom: '24px' }}>
    <span style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '4px' }}>BAUHAUS DESSAU</span>
    <span style={{ fontSize: '20px', fontWeight: 800, color: '#D02020' }}>REVISION 02</span>
  </div>
  <div style={{ display: 'flex', flex: 1, marginTop: '36px', marginBottom: '36px', gap: '32px' }}>
    <div style={{ display: 'flex', flex: 1, backgroundColor: '#D02020', padding: '32px', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '24px', backgroundColor: '#FBBF24' }} />
        <div style={{ width: '48px', height: '48px', borderRadius: '24px', backgroundColor: '#F5F5F0' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '72px', fontWeight: 800, color: '#F5F5F0', lineHeight: 1 }}>FORM</span>
        <span style={{ fontSize: '72px', fontWeight: 800, color: '#F5F5F0', lineHeight: 1 }}>FOLLOWS</span>
        <span style={{ fontSize: '72px', fontWeight: 800, color: '#FBBF24', lineHeight: 1 }}>FUNCTION</span>
      </div>
    </div>
    <div style={{ display: 'flex', width: '360px', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', height: '240px', backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="140" height="140" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="#FBBF24" />
          <rect x="25" y="25" width="50" height="50" fill="#D02020" />
        </svg>
      </div>
      <div style={{ display: 'flex', flex: 1, backgroundColor: '#111111', padding: '24px', flexDirection: 'column', justifyContent: 'center' }}>
        <p style={{ color: '#F5F5F0', fontSize: '18px', margin: 0, lineHeight: 1.5 }}>
          Updated composition featuring dual primary geometric badges and elevated contrast accents.
        </p>
      </div>
    </div>
  </div>
  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '4px solid #111111', paddingTop: '16px' }}>
    <span style={{ fontSize: '16px', fontWeight: 700 }}>RENDERLOOM DESIGN LABS</span>
    <span style={{ fontSize: '16px' }}>EDITION 02 // CANDIDATE 01</span>
  </div>
</div>`;

const SAMPLE_JSX_CANDIDATE_2_V1 = `<div
  style={{
    display: 'flex',
    flexDirection: 'column',
    width: '1200px',
    height: '1200px',
    backgroundColor: '#111111',
    color: '#F5F5F0',
    padding: '48px',
    justifyContent: 'space-between',
    fontFamily: 'sans-serif',
  }}
>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '4px solid #D02020', paddingBottom: '24px' }}>
    <span style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '6px', color: '#FBBF24' }}>GEOMETRIE</span>
    <span style={{ fontSize: '18px', fontWeight: 400, color: '#F5F5F0' }}>WEIMAR 1919</span>
  </div>
  <div style={{ display: 'flex', flex: 1, margin: '40px 0', gap: '32px', alignItems: 'stretch' }}>
    <div style={{ display: 'flex', width: '380px', backgroundColor: '#F5F5F0', color: '#111111', padding: '36px', flexDirection: 'column', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '56px', fontWeight: 800, lineHeight: 1.1 }}>BALANCE & TENSION</span>
      <p style={{ fontSize: '16px', lineHeight: 1.6, margin: 0 }}>
        Strict mathematical proportions contrasted with unadorned surfaces.
      </p>
    </div>
    <div style={{ display: 'flex', flex: 1, backgroundColor: '#1D4ED8', padding: '40px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <svg width="280" height="280" viewBox="0 0 200 200">
        <rect x="20" y="20" width="160" height="160" fill="#D02020" />
        <circle cx="100" cy="100" r="60" fill="#FBBF24" />
        <path d="M 40 160 L 160 40" stroke="#111111" strokeWidth="12" />
      </svg>
    </div>
  </div>
  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #71717A', paddingTop: '16px' }}>
    <span style={{ fontSize: '14px', color: '#71717A' }}>RENDERLOOM SAMPLE GENERATOR</span>
    <span style={{ fontSize: '14px', color: '#FBBF24' }}>CANDIDATE 02 // ORIGINAL</span>
  </div>
</div>`;

export interface SampleSessionResult {
  sessionDir: string;
  sessionId: string;
  slug: string;
}

export async function generateSampleSession(options?: {
  outputDir?: string;
}): Promise<SampleSessionResult> {
  const sessionService = new SessionService(options?.outputDir);
  const session = await sessionService.createSession(
    {
      name: "Bauhaus Geometric Poster",
      providerId: "openai",
      modelId: "gpt-4o",
      styleId: "bauhaus",
      width: 1200,
      height: 1200,
    },
    "Exhibition poster for Bauhaus centenary celebrating modernist geometric balance",
  );

  const t0 = new Date().toISOString();
  const t1 = new Date(Date.now() + 1000).toISOString();
  const t2 = new Date(Date.now() + 2000).toISOString();

  // 1. Candidate 1 (design-001): Version 1
  const c1v1Render = await render(SAMPLE_JSX_CANDIDATE_1_V1, {
    width: 1200,
    height: 1200,
  });
  await sessionService.saveArtifact(
    session.id,
    "source",
    "design-001-v001.jsx",
    SAMPLE_JSX_CANDIDATE_1_V1,
  );
  await sessionService.saveArtifact(
    session.id,
    "svg",
    "design-001-v001.svg",
    c1v1Render.svg,
  );
  await sessionService.saveArtifact(
    session.id,
    "images",
    "design-001-v001.png",
    c1v1Render.png,
  );

  const c1v1: Version = {
    id: "v001",
    candidateId: "design-001",
    versionNumber: 1,
    promptSnapshot:
      "Exhibition poster for Bauhaus centenary celebrating modernist geometric balance",
    jsxSourcePath: "source/design-001-v001.jsx",
    svgPath: "svg/design-001-v001.svg",
    pngPath: "images/design-001-v001.png",
    createdAt: t0,
    label: "Initial geometric layout",
    rationale: "Primary color blocks and bold typography",
  };

  // 2. Candidate 1 (design-001): Version 2 (revision)
  const c1v2Render = await render(SAMPLE_JSX_CANDIDATE_1_V2, {
    width: 1200,
    height: 1200,
  });
  await sessionService.saveArtifact(
    session.id,
    "source",
    "design-001-v002.jsx",
    SAMPLE_JSX_CANDIDATE_1_V2,
  );
  await sessionService.saveArtifact(
    session.id,
    "svg",
    "design-001-v002.svg",
    c1v2Render.svg,
  );
  await sessionService.saveArtifact(
    session.id,
    "images",
    "design-001-v002.png",
    c1v2Render.png,
  );

  const c1v2: Version = {
    id: "v002",
    candidateId: "design-001",
    versionNumber: 2,
    parentVersionId: "v001",
    revisionPrompt: "Add dual circle accents and warm off-white highlights",
    promptSnapshot:
      "Exhibition poster for Bauhaus centenary celebrating modernist geometric balance",
    jsxSourcePath: "source/design-001-v002.jsx",
    svgPath: "svg/design-001-v002.svg",
    pngPath: "images/design-001-v002.png",
    createdAt: t1,
    label: "Revision 02",
    rationale: "Dual accent circular badges added for visual balance",
  };

  const candidate1: Candidate = {
    id: "design-001",
    sessionId: session.id,
    index: 0,
    state: "completed",
    currentVersionId: "v002",
    label: "Bauhaus Primary",
    rationale: "Modernist asymmetric layout with bold color blocks",
    artifacts: {
      sourcePath: "source/design-001-v002.jsx",
      svgPath: "svg/design-001-v002.svg",
      pngPath: "images/design-001-v002.png",
    },
    versions: [c1v1, c1v2],
    timings: {
      generationStartedAt: t0,
      completedAt: t1,
      durationMs: 1000,
    },
    createdAt: t0,
    updatedAt: t1,
  };

  await sessionService.saveCandidate(session.id, candidate1);

  // 3. Candidate 2 (design-002): Version 1
  const c2v1Render = await render(SAMPLE_JSX_CANDIDATE_2_V1, {
    width: 1200,
    height: 1200,
  });
  await sessionService.saveArtifact(
    session.id,
    "source",
    "design-002-v001.jsx",
    SAMPLE_JSX_CANDIDATE_2_V1,
  );
  await sessionService.saveArtifact(
    session.id,
    "svg",
    "design-002-v001.svg",
    c2v1Render.svg,
  );
  await sessionService.saveArtifact(
    session.id,
    "images",
    "design-002-v001.png",
    c2v1Render.png,
  );

  const c2v1: Version = {
    id: "v001",
    candidateId: "design-002",
    versionNumber: 1,
    promptSnapshot:
      "Exhibition poster for Bauhaus centenary celebrating modernist geometric balance",
    jsxSourcePath: "source/design-002-v001.jsx",
    svgPath: "svg/design-002-v001.svg",
    pngPath: "images/design-002-v001.png",
    createdAt: t0,
    label: "Diagonal composition",
    rationale: "High-contrast dark background with diagonal dynamic vector",
  };

  const candidate2: Candidate = {
    id: "design-002",
    sessionId: session.id,
    index: 1,
    state: "completed",
    currentVersionId: "v001",
    label: "Dynamic Diagonal",
    rationale: "High-contrast geometric balance",
    artifacts: {
      sourcePath: "source/design-002-v001.jsx",
      svgPath: "svg/design-002-v001.svg",
      pngPath: "images/design-002-v001.png",
    },
    versions: [c2v1],
    timings: {
      generationStartedAt: t0,
      completedAt: t2,
      durationMs: 2000,
    },
    createdAt: t0,
    updatedAt: t2,
  };

  await sessionService.saveCandidate(session.id, candidate2);

  // Record batch summary
  const batchId = randomUUID();
  await sessionService.recordBatchSummary(
    session.id,
    {
      batchId,
      status: "completed",
      totalCandidates: 2,
      successfulCandidates: 2,
      failedCandidates: 0,
      cancelledCandidates: 0,
      completedAt: t2,
    },
    [candidate1, candidate2],
  );

  // Append revision message to conversation
  await sessionService.appendConversationMessage(session.id, {
    id: randomUUID(),
    role: "user",
    content: "Add dual circle accents and warm off-white highlights",
    timestamp: t1,
    versionId: "v002",
  });

  const sessionDir = path.join(sessionService.baseDir, session.slug);

  return {
    sessionDir,
    sessionId: session.id,
    slug: session.slug,
  };
}

if (import.meta.main) {
  try {
    const result = await generateSampleSession();
    console.log(
      `Successfully generated sample session at: ${result.sessionDir}`,
    );
  } catch (err) {
    console.error("Failed to generate sample session:", err);
    process.exit(1);
  }
}
