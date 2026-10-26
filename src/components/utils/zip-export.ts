// @ts-expect-error fflate package.json exports missing types field for moduleResolution bundler
import { type Zippable, strToU8, zip } from "fflate";
import type { Candidate } from "../../domain/candidate";
import type { Session } from "../../domain/session";
import { buildArtifactUrl } from "./artifact-url";

export interface BatchZipSession {
  id: string;
  slug?: string;
  name?: string;
  providerId?: string;
  modelId?: string;
  styleId?: string;
  dimensions?: {
    width: number;
    height: number;
  };
}

export type BatchZipFetchFn = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface BatchZipOptions {
  session: BatchZipSession | Session;
  candidates: Candidate[];
  promptSnapshot?: string | null;
  fetchFn?: BatchZipFetchFn;
}

export interface BatchZipResult {
  filename: string;
  bytes: Uint8Array;
  fileCount: number;
}

export function formatCandidateFilename(index: number, ext: string): string {
  const num = String(index + 1).padStart(2, "0");
  return `candidate-${num}.${ext}`;
}

export async function buildBatchZipArchive(
  options: BatchZipOptions,
): Promise<BatchZipResult> {
  const { session, candidates, promptSnapshot, fetchFn } = options;
  const fetcher = fetchFn ?? globalThis.fetch;

  const completedCandidates = candidates.filter((c) => c.state === "completed");
  if (completedCandidates.length === 0) {
    throw new Error("No completed candidates available for export");
  }

  const archive: Zippable = {};

  // Fetch artifacts in parallel across completed candidates
  await Promise.all(
    completedCandidates.map(async (candidate, idx) => {
      const candidateIndex =
        typeof candidate.index === "number" ? candidate.index : idx;

      // 1. PNG Image
      if (candidate.artifacts?.pngPath) {
        const rawFilename = candidate.artifacts.pngPath.split("/").pop();
        if (rawFilename) {
          try {
            const url = buildArtifactUrl(session.id, "images", rawFilename);
            const res = await fetcher(url);
            if (res.ok) {
              const buf = await res.arrayBuffer();
              archive[`png/${formatCandidateFilename(candidateIndex, "png")}`] =
                new Uint8Array(buf);
            } else {
              console.warn(
                `Failed to fetch PNG artifact (${rawFilename}) for candidate ${candidate.id}: status ${res.status}`,
              );
            }
          } catch (err) {
            console.warn(
              `Error fetching PNG artifact for candidate ${candidate.id}:`,
              err,
            );
          }
        }
      }

      // 2. SVG Vector
      if (candidate.artifacts?.svgPath) {
        const rawFilename = candidate.artifacts.svgPath.split("/").pop();
        if (rawFilename) {
          try {
            const url = buildArtifactUrl(session.id, "svg", rawFilename);
            const res = await fetcher(url);
            if (res.ok) {
              const buf = await res.arrayBuffer();
              archive[`svg/${formatCandidateFilename(candidateIndex, "svg")}`] =
                new Uint8Array(buf);
            } else {
              console.warn(
                `Failed to fetch SVG artifact (${rawFilename}) for candidate ${candidate.id}: status ${res.status}`,
              );
            }
          } catch (err) {
            console.warn(
              `Error fetching SVG artifact for candidate ${candidate.id}:`,
              err,
            );
          }
        }
      }

      // 3. JSX Source
      if (candidate.artifacts?.sourcePath) {
        const rawFilename = candidate.artifacts.sourcePath.split("/").pop();
        if (rawFilename) {
          try {
            const url = buildArtifactUrl(session.id, "source", rawFilename);
            const res = await fetcher(url);
            if (res.ok) {
              const buf = await res.arrayBuffer();
              archive[`jsx/${formatCandidateFilename(candidateIndex, "jsx")}`] =
                new Uint8Array(buf);
            } else {
              console.warn(
                `Failed to fetch JSX artifact (${rawFilename}) for candidate ${candidate.id}: status ${res.status}`,
              );
            }
          } catch (err) {
            console.warn(
              `Error fetching JSX artifact for candidate ${candidate.id}:`,
              err,
            );
          }
        }
      }
    }),
  );

  // Metadata session-info.json at root
  const sessionInfo = {
    schemaVersion: 1,
    sessionId: session.id,
    sessionName: session.name ?? null,
    sessionSlug: session.slug ?? null,
    providerId: session.providerId ?? null,
    modelId: session.modelId ?? null,
    styleId: session.styleId ?? null,
    dimensions: session.dimensions ?? null,
    promptSnapshot: promptSnapshot ?? null,
    exportedAt: new Date().toISOString(),
    totalCandidates: candidates.length,
    completedCandidatesCount: completedCandidates.length,
    candidates: completedCandidates.map((c, idx) => {
      const candidateIndex = typeof c.index === "number" ? c.index : idx;
      return {
        id: c.id,
        index: candidateIndex,
        label: c.label ?? null,
        storyArcRole: c.storyArcRole ?? null,
        timings: c.timings ?? null,
        files: {
          png: c.artifacts?.pngPath
            ? `png/${formatCandidateFilename(candidateIndex, "png")}`
            : null,
          svg: c.artifacts?.svgPath
            ? `svg/${formatCandidateFilename(candidateIndex, "svg")}`
            : null,
          jsx: c.artifacts?.sourcePath
            ? `jsx/${formatCandidateFilename(candidateIndex, "jsx")}`
            : null,
        },
      };
    }),
  };

  archive["session-info.json"] = strToU8(JSON.stringify(sessionInfo, null, 2));

  const rawSlugOrId = session.slug?.trim() || session.id;
  const sanitizedSlugOrId = rawSlugOrId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const filename = `renderloom-${sanitizedSlugOrId}.zip`;

  const { promise, resolve, reject } = Promise.withResolvers<Uint8Array>();
  zip(archive, (err: Error | null, data: Uint8Array) => {
    if (err) {
      reject(err);
    } else {
      resolve(data);
    }
  });
  const bytes = await promise;

  return {
    filename,
    bytes,
    fileCount: Object.keys(archive).length,
  };
}

export function triggerZipDownload(bytes: Uint8Array, filename: string): void {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return;
  }

  const blob = new Blob([bytes as unknown as BlobPart], {
    type: "application/zip",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadBatchZip(
  options: BatchZipOptions,
): Promise<BatchZipResult> {
  const result = await buildBatchZipArchive(options);
  triggerZipDownload(result.bytes, result.filename);
  return result;
}
