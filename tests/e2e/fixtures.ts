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

export const MOCK_PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic",
    supportsCustomBaseUrl: true,
    defaultModelId: "claude-3-5-sonnet",
    models: [
      { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", isDefault: true },
      { id: "claude-3-opus", name: "Claude 3 Opus" },
    ],
    status: { configured: false },
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
    status: { configured: false },
  },
];

export const MOCK_STYLES = [
  {
    id: "tech-minimal",
    name: "Tech Minimal",
    description: "Crisp vector geometry",
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
    description: "Balanced sans typography",
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
const TRANSPARENT_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

export async function setupMockRoutes(
  page: Page,
  options?: { emptySession?: boolean; idleSession?: boolean },
) {
  await page.route("**/api/sessions", async (route) => {
    if (route.request().method() === "POST") {
      const body = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          session: {
            id: "new-session-123",
            name: body.name || "Geometric Architecture Poster",
            slug: "geometric-architecture-poster",
            providerId: body.providerId || "anthropic",
            modelId: body.modelId || "claude-3-5-sonnet",
            styleId: body.styleId || "tech-minimal",
            dimensions: {
              width: body.width || 1920,
              height: body.height || 1080,
            },
            candidates: [],
            createdAt: "2026-10-24T12:00:00.000Z",
            updatedAt: "2026-10-24T12:00:00.000Z",
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessions: MOCK_SESSIONS_LIST }),
    });
  });

  await page.route("**/api/sessions/*", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
      return;
    }
    await route.continue();
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
    if (options?.idleSession) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...MOCK_FULL_SESSION_1,
          session: {
            ...MOCK_SESSION_1,
            lastBatchStatus: "idle",
            activeBatchId: undefined,
            candidates: MOCK_SESSION_1.candidates.map((c) =>
              c.state === "generating"
                ? { ...c, state: "completed" as const }
                : c,
            ),
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

  await page.route("**/api/llm/providers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ providers: MOCK_PROVIDERS }),
    });
  });

  await page.route("**/api/llm/test-connection", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        latencyMs: 42,
        modelId: "claude-3-5-sonnet",
      }),
    });
  });

  await page.route("**/api/llm/keys", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        providerId: "anthropic",
        maskedKey: "sk-ant-...49f1",
        status: "held_in_memory",
      }),
    });
  });

  await page.route("**/api/llm/keys/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route("**/api/styles", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ styles: MOCK_STYLES }),
    });
  });

  await page.route("**/api/sessions/new-session-123", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          id: "new-session-123",
          name: "Geometric Architecture Poster",
          slug: "geometric-architecture-poster",
          providerId: "anthropic",
          modelId: "claude-3-5-sonnet",
          styleId: "tech-minimal",
          dimensions: { width: 1920, height: 1080 },
          candidates: [],
          createdAt: "2026-10-24T12:00:00.000Z",
          updatedAt: "2026-10-24T12:00:00.000Z",
        },
        conversation: {
          sessionId: "new-session-123",
          messages: [],
          updatedAt: "2026-10-24T12:00:00.000Z",
        },
        promptSnapshot: "Vector illustration of brutalist pavilion",
        generationConfig: {
          providerId: "anthropic",
          modelId: "claude-3-5-sonnet",
          styleId: "tech-minimal",
          candidateCount: 4,
          width: 1920,
          height: 1080,
          outputFormat: "png",
          createdAt: "2026-10-24T12:00:00.000Z",
        },
        artifacts: { images: [], source: [], svg: [], assets: [] },
      }),
    });
  });

  await page.route("**/api/generations", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          batchId: "batch-202",
          sessionId: "studio-brand-identity",
          status: "running",
          candidates: [
            {
              id: "cand-new-1",
              sessionId: "studio-brand-identity",
              index: 0,
              state: "generating",
              label: "Candidate 1",
              createdAt: "2026-10-24T12:00:00.000Z",
              updatedAt: "2026-10-24T12:00:00.000Z",
            },
          ],
        }),
      });
    }
  });

  await page.route("**/api/generations/*/events", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: {
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      body: ": keepalive\n\n",
    });
  });
}
