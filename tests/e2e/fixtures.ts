import type { Page } from "@playwright/test";

export const MOCK_SESSION_1 = {
  id: "studio-brand-identity",
  name: "Studio Brand Identity",
  slug: "studio-brand-identity",
  providerId: "anthropic",
  modelId: "claude-3-5-sonnet",
  styleId: "tech-minimal",
  dimensions: { width: 1024, height: 1024 },
  activeBatchId: "batch-101",
  lastBatchStatus: "running",
  createdAt: "2026-10-24T00:00:00.000Z",
  updatedAt: "2026-10-24T00:05:00.000Z",
  candidates: [
    {
      id: "cand-1",
      sessionId: "studio-brand-identity",
      index: 0,
      state: "completed",
      label: "Geometric Monogram",
      rationale: "Clean vector monogram with golden ratio balance",
      currentVersionId: "v002",
      artifacts: {
        pngPath: "images/cand-1.png",
        svgPath: "svg/cand-1.svg",
        sourcePath: "source/cand-1.tsx",
      },
      timings: { durationMs: 1850 },
      versions: [
        {
          id: "v001",
          candidateId: "cand-1",
          versionNumber: 1,
          prompt: "Initial geometric monogram",
          state: "completed",
          pngPath: "images/cand-1-v1.png",
          createdAt: "2026-10-24T00:01:00.000Z",
        },
        {
          id: "v002",
          candidateId: "cand-1",
          versionNumber: 2,
          parentVersionId: "v001",
          prompt: "Enhance stroke weights and amber contrast",
          state: "completed",
          pngPath: "images/cand-1.png",
          createdAt: "2026-10-24T00:02:00.000Z",
        },
      ],
      createdAt: "2026-10-24T00:01:00.000Z",
      updatedAt: "2026-10-24T00:02:00.000Z",
    },
    {
      id: "cand-2",
      sessionId: "studio-brand-identity",
      index: 1,
      state: "completed",
      label: "Architectural Emblem",
      rationale: "Bold industrial geometry with crisp symmetry",
      currentVersionId: "v001",
      artifacts: {
        pngPath: "images/cand-2.png",
        svgPath: "svg/cand-2.svg",
        sourcePath: "source/cand-2.tsx",
      },
      timings: { durationMs: 2100 },
      createdAt: "2026-10-24T00:01:00.000Z",
      updatedAt: "2026-10-24T00:03:00.000Z",
    },
    {
      id: "cand-3",
      sessionId: "studio-brand-identity",
      index: 2,
      state: "failed",
      label: "Abstract Wireframe",
      rationale: "Attempted nested perspective grid",
      errorMessage: "AST validation failed: Invalid JSX element <UnknownTag>",
      errorCode: "AST_VALIDATION_ERROR",
      timings: { durationMs: 950 },
      createdAt: "2026-10-24T00:01:00.000Z",
      updatedAt: "2026-10-24T00:02:30.000Z",
    },
    {
      id: "cand-4",
      sessionId: "studio-brand-identity",
      index: 3,
      state: "generating",
      label: "Precision Lattice",
      rationale: "Calculating coordinate matrix",
      createdAt: "2026-10-24T00:01:00.000Z",
      updatedAt: "2026-10-24T00:01:00.000Z",
    },
  ],
};

export const MOCK_SESSION_2 = {
  id: "minimal-geometric-icons",
  name: "Minimal Geometric Icons",
  slug: "minimal-geometric-icons",
  providerId: "openai",
  modelId: "gpt-4o",
  styleId: "modern-clean",
  dimensions: { width: 512, height: 512 },
  createdAt: "2026-10-24T00:00:00.000Z",
  updatedAt: "2026-10-24T00:05:00.000Z",
  candidates: [],
};

export const MOCK_FULL_SESSION_1 = {
  session: MOCK_SESSION_1,
  promptSnapshot:
    "High precision geometric atelier logo with luminous amber accents.",
  generationConfig: {
    providerId: "anthropic",
    modelId: "claude-3-5-sonnet",
    styleId: "tech-minimal",
    candidateCount: 4,
    width: 1024,
    height: 1024,
    outputFormat: "png",
    createdAt: "2026-10-24T00:00:00.000Z",
  },
};

export const MOCK_FULL_SESSION_2 = {
  session: MOCK_SESSION_2,
  promptSnapshot: "Vector iconography set for studio telemetry.",
  generationConfig: {
    providerId: "openai",
    modelId: "gpt-4o",
    styleId: "modern-clean",
    candidateCount: 2,
    width: 512,
    height: 512,
    outputFormat: "png",
    createdAt: "2026-10-24T00:00:00.000Z",
  },
};

export const MOCK_SESSIONS_LIST = [
  {
    id: MOCK_SESSION_1.id,
    name: MOCK_SESSION_1.name,
    slug: MOCK_SESSION_1.slug,
    providerId: MOCK_SESSION_1.providerId,
    modelId: MOCK_SESSION_1.modelId,
    styleId: MOCK_SESSION_1.styleId,
    dimensions: MOCK_SESSION_1.dimensions,
    createdAt: MOCK_SESSION_1.createdAt,
    updatedAt: MOCK_SESSION_1.updatedAt,
  },
  {
    id: MOCK_SESSION_2.id,
    name: MOCK_SESSION_2.name,
    slug: MOCK_SESSION_2.slug,
    providerId: MOCK_SESSION_2.providerId,
    modelId: MOCK_SESSION_2.modelId,
    styleId: MOCK_SESSION_2.styleId,
    dimensions: MOCK_SESSION_2.dimensions,
    createdAt: MOCK_SESSION_2.createdAt,
    updatedAt: MOCK_SESSION_2.updatedAt,
  },
];

export const MOCK_JSX_SOURCE = `import React from "react";

export default function RenderloomAtelierLogo() {
  return (
    <div style={{ display: "flex", width: 1024, height: 1024, background: "#0d0e11" }}>
      <svg width="1024" height="1024" viewBox="0 0 1024 1024">
        <rect width="1024" height="1024" fill="#0d0e11" />
        <circle cx="512" cy="512" r="256" stroke="#e5a84b" strokeWidth="8" fill="none" />
        <line x1="256" y1="512" x2="768" y2="512" stroke="#e5a84b" strokeWidth="4" />
      </svg>
    </div>
  );
}`;

export const MOCK_SVG_SOURCE = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#0d0e11"/>
  <circle cx="512" cy="512" r="256" stroke="#e5a84b" stroke-width="8" fill="none"/>
  <line x1="256" y1="512" x2="768" y2="512" stroke="#e5a84b" stroke-width="4"/>
</svg>`;
const TRANSPARENT_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

export async function setupMockRoutes(
  page: Page,
  options?: { emptySession?: boolean },
) {
  await page.route("**/api/sessions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessions: MOCK_SESSIONS_LIST }),
    });
  });

  await page.route("**/api/sessions/studio-brand-identity", async (route) => {
    if (options?.emptySession) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...MOCK_FULL_SESSION_1,
          session: {
            ...MOCK_SESSION_1,
            candidates: [],
            lastBatchStatus: "idle",
            activeBatchId: undefined,
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_FULL_SESSION_1),
    });
  });

  await page.route("**/api/sessions/minimal-geometric-icons", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_FULL_SESSION_2),
    });
  });

  await page.route("**/api/sessions/*/artifacts/source/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: MOCK_JSX_SOURCE,
    });
  });

  await page.route("**/api/sessions/*/artifacts/svg/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: MOCK_SVG_SOURCE,
    });
  });

  await page.route("**/api/sessions/*/artifacts/images/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: TRANSPARENT_PNG_BUFFER,
    });
  });

  await page.route("**/api/sessions/*/batches/*/cancel", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "Batch cancelled" }),
    });
  });

  await page.route("**/api/sessions/*/candidates/*/retry", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        candidate: { ...MOCK_SESSION_1.candidates[2], state: "queued" },
      }),
    });
  });

  await page.route("**/api/sessions/*/candidates/*/revise", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        candidate: MOCK_SESSION_1.candidates[0],
      }),
    });
  });
}
