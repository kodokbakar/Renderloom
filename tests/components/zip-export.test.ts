import { describe, expect, test } from "bun:test";
// @ts-expect-error fflate package.json exports missing types field for moduleResolution bundler
import { unzipSync } from "fflate";
import {
  type BatchZipFetchFn,
  buildBatchZipArchive,
  downloadBatchZip,
  formatCandidateFilename,
  triggerZipDownload,
} from "../../src/components/utils/zip-export";
import type { Candidate } from "../../src/domain/candidate";
import type { Session } from "../../src/domain/session";

describe("zip-export", () => {
  const mockSession: Session = {
    id: "sess-123",
    name: "Cyberpunk Posters",
    slug: "cyberpunk-posters",
    providerId: "openai",
    modelId: "gpt-4o",
    styleId: "cyberpunk",
    dimensions: { width: 1024, height: 1024 },
    createdAt: "2026-03-30T10:00:00Z",
    updatedAt: "2026-03-30T10:05:00Z",
  };

  const completedCandidate1: Candidate = {
    id: "cand-1",
    sessionId: "sess-123",
    index: 0,
    state: "completed",
    label: "Variant Neon City",
    storyArcRole: "hook",
    artifacts: {
      pngPath: "images/cand-1.png",
      svgPath: "svg/cand-1.svg",
      sourcePath: "source/cand-1.tsx",
    },
    timings: {
      durationMs: 1200,
    },
    createdAt: "2026-03-30T10:01:00Z",
    updatedAt: "2026-03-30T10:02:00Z",
  };

  const completedCandidate2: Candidate = {
    id: "cand-2",
    sessionId: "sess-123",
    index: 1,
    state: "completed",
    label: "Variant Street Alley",
    storyArcRole: "core",
    artifacts: {
      pngPath: "images/cand-2.png",
      svgPath: "svg/cand-2.svg",
      sourcePath: "source/cand-2.tsx",
    },
    timings: {
      durationMs: 980,
    },
    createdAt: "2026-03-30T10:02:00Z",
    updatedAt: "2026-03-30T10:03:00Z",
  };

  const failedCandidate: Candidate = {
    id: "cand-3",
    sessionId: "sess-123",
    index: 2,
    state: "failed",
    errorMessage: "Syntax error in generated JSX",
    createdAt: "2026-03-30T10:03:00Z",
    updatedAt: "2026-03-30T10:04:00Z",
  };

  test("formatCandidateFilename generates 2-digit zero-padded candidate filenames", () => {
    expect(formatCandidateFilename(0, "png")).toBe("candidate-01.png");
    expect(formatCandidateFilename(1, "svg")).toBe("candidate-02.svg");
    expect(formatCandidateFilename(9, "jsx")).toBe("candidate-10.jsx");
    expect(formatCandidateFilename(99, "png")).toBe("candidate-100.png");
  });

  test("buildBatchZipArchive creates Option A folder hierarchy and session-info.json", async () => {
    const mockPngBytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    const mockSvgText = "<svg><circle cx='10' cy='10' r='5'/></svg>";
    const mockJsxText = "export default function Artwork() { return <div />; }";

    const customFetch: BatchZipFetchFn = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/artifacts/images/")) {
        return new Response(mockPngBytes, {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });
      }
      if (url.includes("/artifacts/svg/")) {
        return new Response(mockSvgText, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        });
      }
      if (url.includes("/artifacts/source/")) {
        return new Response(mockJsxText, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }
      return new Response("Not found", { status: 404 });
    };

    const result = await buildBatchZipArchive({
      session: mockSession,
      candidates: [completedCandidate1, failedCandidate],
      promptSnapshot: "Cyberpunk street in rain with neon glow",
      fetchFn: customFetch,
    });

    expect(result.filename).toBe("renderloom-cyberpunk-posters.zip");
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(result.fileCount).toBe(4); // png, svg, jsx, session-info.json

    // Unzip and inspect files
    const unzipped = unzipSync(result.bytes);
    const filenames = Object.keys(unzipped).sort();
    expect(filenames).toEqual([
      "jsx/candidate-01.jsx",
      "png/candidate-01.png",
      "session-info.json",
      "svg/candidate-01.svg",
    ]);

    // Check PNG contents
    const pngContent = unzipped["png/candidate-01.png"];
    expect(pngContent).toBeDefined();
    expect(Array.from(pngContent ?? [])).toEqual(Array.from(mockPngBytes));

    // Check SVG contents
    const svgContent = unzipped["svg/candidate-01.svg"];
    expect(new TextDecoder().decode(svgContent)).toBe(mockSvgText);

    // Check JSX contents
    const jsxContent = unzipped["jsx/candidate-01.jsx"];
    expect(new TextDecoder().decode(jsxContent)).toBe(mockJsxText);

    // Check session-info.json
    const infoJson = JSON.parse(
      new TextDecoder().decode(unzipped["session-info.json"]),
    );
    expect(infoJson.schemaVersion).toBe(1);
    expect(infoJson.sessionId).toBe("sess-123");
    expect(infoJson.sessionName).toBe("Cyberpunk Posters");
    expect(infoJson.sessionSlug).toBe("cyberpunk-posters");
    expect(infoJson.providerId).toBe("openai");
    expect(infoJson.modelId).toBe("gpt-4o");
    expect(infoJson.styleId).toBe("cyberpunk");
    expect(infoJson.promptSnapshot).toBe(
      "Cyberpunk street in rain with neon glow",
    );
    expect(infoJson.totalCandidates).toBe(2);
    expect(infoJson.completedCandidatesCount).toBe(1);
    expect(infoJson.candidates).toHaveLength(1);
    expect(infoJson.candidates[0].id).toBe("cand-1");
    expect(infoJson.candidates[0].index).toBe(0);
    expect(infoJson.candidates[0].label).toBe("Variant Neon City");
    expect(infoJson.candidates[0].storyArcRole).toBe("hook");
    expect(infoJson.candidates[0].files).toEqual({
      png: "png/candidate-01.png",
      svg: "svg/candidate-01.svg",
      jsx: "jsx/candidate-01.jsx",
    });
  });

  test("buildBatchZipArchive packages multiple candidates with sequential filenames", async () => {
    const customFetch: BatchZipFetchFn = async () =>
      new Response("artifact data", { status: 200 });

    const result = await buildBatchZipArchive({
      session: mockSession,
      candidates: [completedCandidate1, completedCandidate2],
      fetchFn: customFetch,
    });

    const unzipped = unzipSync(result.bytes);
    const keys = Object.keys(unzipped);

    expect(keys).toContain("png/candidate-01.png");
    expect(keys).toContain("svg/candidate-01.svg");
    expect(keys).toContain("jsx/candidate-01.jsx");
    expect(keys).toContain("png/candidate-02.png");
    expect(keys).toContain("svg/candidate-02.svg");
    expect(keys).toContain("jsx/candidate-02.jsx");
    expect(keys).toContain("session-info.json");
    expect(result.fileCount).toBe(7);
  });

  test("buildBatchZipArchive throws error when no completed candidates are present", async () => {
    await expect(
      buildBatchZipArchive({
        session: mockSession,
        candidates: [failedCandidate],
      }),
    ).rejects.toThrow("No completed candidates available for export");
  });

  test("buildBatchZipArchive is resilient against partial artifact fetch failures", async () => {
    // PNG succeeds, SVG 404s, JSX throws network error
    const customFetch: BatchZipFetchFn = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/artifacts/images/")) {
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      }
      if (url.includes("/artifacts/svg/")) {
        return new Response("Not found", { status: 404 });
      }
      throw new Error("Network error fetching JSX");
    };

    const result = await buildBatchZipArchive({
      session: mockSession,
      candidates: [completedCandidate1],
      fetchFn: customFetch,
    });

    const unzipped = unzipSync(result.bytes);
    const keys = Object.keys(unzipped);

    expect(keys).toContain("png/candidate-01.png");
    expect(keys).not.toContain("svg/candidate-01.svg");
    expect(keys).not.toContain("jsx/candidate-01.jsx");
    expect(keys).toContain("session-info.json");
    expect(result.fileCount).toBe(2);
  });

  test("buildBatchZipArchive falls back to sessionId when slug is absent", async () => {
    const sessionWithoutSlug: Session = {
      ...mockSession,
      slug: "",
    };

    const customFetch: BatchZipFetchFn = async () =>
      new Response("test", { status: 200 });

    const result = await buildBatchZipArchive({
      session: sessionWithoutSlug,
      candidates: [completedCandidate1],
      fetchFn: customFetch,
    });

    expect(result.filename).toBe("renderloom-sess-123.zip");
  });

  test("triggerZipDownload executes safely in headless environment", () => {
    expect(() => {
      triggerZipDownload(new Uint8Array([1, 2, 3]), "test.zip");
    }).not.toThrow();
  });

  test("downloadBatchZip triggers build and returns result", async () => {
    const customFetch: BatchZipFetchFn = async () =>
      new Response("data", { status: 200 });

    const result = await downloadBatchZip({
      session: mockSession,
      candidates: [completedCandidate1],
      fetchFn: customFetch,
    });

    expect(result.filename).toBe("renderloom-cyberpunk-posters.zip");
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(result.fileCount).toBe(4);
  });
});
