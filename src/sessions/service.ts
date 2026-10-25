import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  type BatchSummary,
  type Candidate,
  type Conversation,
  type ConversationMessage,
  type CreateSessionRequest,
  type FullSession,
  type GenerationConfig,
  SESSION_SCHEMA_VERSION,
  type Session,
  type SessionArtifacts,
  SessionError,
  type SessionSummary,
  type Version,
} from "../domain";
import { loadBasePrompt } from "../prompts/loader";
import {
  atomicWriteFile,
  atomicWriteJson,
  cleanupOrphanedTempFiles,
} from "./atomic";
import {
  resolveOutputsDir,
  validateArtifactPath,
  validateSessionPath,
} from "./paths";
import { createSessionSlug } from "./slug";

export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".jsx":
    case ".js":
    case ".ts":
    case ".tsx":
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".json":
      return "application/json";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}
export function hydrateCandidateVersions(
  candidate: Candidate,
  promptSnapshot?: string,
): Candidate {
  if (candidate.state !== "completed") {
    return candidate;
  }
  if (candidate.versions && candidate.versions.length > 0) {
    return candidate;
  }
  const versionId = candidate.currentVersionId || "v001";
  const jsxSourcePath =
    candidate.artifacts?.sourcePath ||
    `source/${candidate.id}-${versionId}.jsx`;
  const svgPath =
    candidate.artifacts?.svgPath || `svg/${candidate.id}-${versionId}.svg`;
  const pngPath =
    candidate.artifacts?.pngPath || `images/${candidate.id}-${versionId}.png`;
  const createdAt =
    candidate.timings?.completedAt ||
    candidate.updatedAt ||
    candidate.createdAt;

  const initialVersion: Version = {
    id: versionId,
    candidateId: candidate.id,
    versionNumber: 1,
    promptSnapshot: promptSnapshot || "",
    jsxSourcePath,
    svgPath,
    pngPath,
    createdAt,
    label: candidate.label,
    rationale: candidate.rationale,
  };

  candidate.currentVersionId = versionId;
  candidate.versions = [initialVersion];
  return candidate;
}

export interface UpdateSessionData {
  name?: string;
  providerId?: string;
  modelId?: string;
}

export class SessionService {
  readonly baseDir: string;
  private readonly reservedSlugs = new Set<string>();
  // ponytail: instance-level serialized creation lock, use per-slug locks or distributed lock if cross-process concurrency needed
  private creationLock = Promise.resolve();
  private async withCreationLock<T>(fn: () => Promise<T>): Promise<T> {
    const { promise: ticket, resolve: release } = Promise.withResolvers<void>();
    const wait = this.creationLock;
    this.creationLock = ticket;
    await wait;
    try {
      return await fn();
    } finally {
      release();
    }
  }
  // ponytail: instance-level serialized write lock for session updates to prevent concurrent read-modify-write races
  private sessionWriteLock = Promise.resolve();
  private async withSessionWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    const { promise: ticket, resolve: release } = Promise.withResolvers<void>();
    const wait = this.sessionWriteLock;
    this.sessionWriteLock = ticket;
    await wait;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  constructor(customOutputsDir?: string) {
    this.baseDir = resolveOutputsDir(customOutputsDir);
  }

  async ensureBaseDir(): Promise<string> {
    if (!existsSync(this.baseDir)) {
      await mkdir(this.baseDir, { recursive: true });
    }
    return this.baseDir;
  }

  private async getExistingSlugs(): Promise<Set<string>> {
    await this.ensureBaseDir();
    const entries = await readdir(this.baseDir, { withFileTypes: true });
    const slugs = new Set<string>();
    for (const entry of entries) {
      if (entry.isDirectory()) {
        slugs.add(entry.name);
      }
    }
    return slugs;
  }

  private async resolveSessionDir(
    idOrSlug: string,
  ): Promise<{ dir: string; session: Session }> {
    if (!idOrSlug || typeof idOrSlug !== "string") {
      throw new SessionError("SESSION_NOT_FOUND", "Invalid session identifier");
    }

    await this.ensureBaseDir();

    // Check if directly matches a valid slug directory
    try {
      const directDir = validateSessionPath(this.baseDir, idOrSlug);
      const sessionJsonPath = path.join(directDir, "session.json");
      if (existsSync(sessionJsonPath)) {
        const raw = await readFile(sessionJsonPath, "utf-8");
        const session = JSON.parse(raw) as Session;
        return { dir: directDir, session };
      }
    } catch (err) {
      if (err instanceof SessionError && err.code === "INVALID_PATH") {
        throw err; // Traversal attack rejected immediately
      }
      // If it failed because of case or formatting, fallback to scan
    }

    // Scan all session directories to find matching id or slug
    const entries = await readdir(this.baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidateDir = path.join(this.baseDir, entry.name);
      const sessionJsonPath = path.join(candidateDir, "session.json");
      if (!existsSync(sessionJsonPath)) continue;

      try {
        const raw = await readFile(sessionJsonPath, "utf-8");
        const session = JSON.parse(raw) as Session;
        if (session.id === idOrSlug || session.slug === idOrSlug) {
          return { dir: candidateDir, session };
        }
      } catch {
        // Ignore malformed session.json during scan
      }
    }

    throw new SessionError(
      "SESSION_NOT_FOUND",
      `Session '${idOrSlug}' not found`,
    );
  }

  async createSession(
    data: CreateSessionRequest,
    initialPrompt = "",
    basePromptSnapshot?: string,
  ): Promise<Session> {
    return this.withCreationLock(async () => {
      await this.ensureBaseDir();

      const existingSlugs = await this.getExistingSlugs();
      const slug = createSessionSlug(
        data.name,
        (s) => existingSlugs.has(s) || this.reservedSlugs.has(s),
      );
      this.reservedSlugs.add(slug);

      try {
        const sessionDir = validateSessionPath(this.baseDir, slug);

        if (existsSync(sessionDir)) {
          throw new SessionError(
            "SESSION_ALREADY_EXISTS",
            `Session directory '${slug}' already exists`,
          );
        }

        // Create session and subdirectories
        await mkdir(path.join(sessionDir, "images"), { recursive: true });
        await mkdir(path.join(sessionDir, "source"), { recursive: true });
        await mkdir(path.join(sessionDir, "svg"), { recursive: true });
        await mkdir(path.join(sessionDir, "assets"), { recursive: true });

        const now = new Date().toISOString();
        const sessionId = randomUUID();

        const session: Session = {
          schemaVersion: SESSION_SCHEMA_VERSION,
          id: sessionId,
          name: data.name.trim(),
          slug,
          createdAt: now,
          updatedAt: now,
          providerId: data.providerId,
          modelId: data.modelId,
          styleId: data.styleId,
          dimensions: {
            width: data.width,
            height: data.height,
          },
        };

        const conversation: Conversation = {
          sessionId,
          messages: initialPrompt.trim()
            ? [
                {
                  id: randomUUID(),
                  role: "user",
                  content: initialPrompt.trim(),
                  timestamp: now,
                },
              ]
            : [],
          updatedAt: now,
        };

        const generationConfig: GenerationConfig = {
          providerId: data.providerId,
          modelId: data.modelId,
          styleId: data.styleId,
          candidateCount: 1,
          width: data.width,
          height: data.height,
          outputFormat: "png",
          createdAt: now,
        };

        // Atomically write metadata
        await atomicWriteJson(path.join(sessionDir, "session.json"), session);
        await atomicWriteJson(
          path.join(sessionDir, "conversation.json"),
          conversation,
        );
        const effectiveSnapshot =
          basePromptSnapshot !== undefined
            ? basePromptSnapshot
            : initialPrompt.trim() !== ""
              ? initialPrompt.trim()
              : await loadBasePrompt();

        await atomicWriteFile(
          path.join(sessionDir, "prompt.snapshot.txt"),
          effectiveSnapshot,
        );
        await atomicWriteJson(
          path.join(sessionDir, "generation-config.json"),
          generationConfig,
        );

        return session;
      } finally {
        this.reservedSlugs.delete(slug);
      }
    });
  }

  async listSessions(): Promise<SessionSummary[]> {
    await this.ensureBaseDir();
    await cleanupOrphanedTempFiles(this.baseDir);

    const entries = await readdir(this.baseDir, { withFileTypes: true });
    const summaries: SessionSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const sessionJsonPath = path.join(
        this.baseDir,
        entry.name,
        "session.json",
      );
      if (!existsSync(sessionJsonPath)) continue;

      try {
        const raw = await readFile(sessionJsonPath, "utf-8");
        const session = JSON.parse(raw) as Session;

        if (!session.id || !session.name || !session.slug) {
          continue; // Skip malformed session
        }

        summaries.push({
          id: session.id,
          name: session.name,
          slug: session.slug,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          providerId: session.providerId,
          modelId: session.modelId,
          styleId: session.styleId,
          dimensions: session.dimensions,
          candidateCount: session.candidates?.length ?? 0,
        });
      } catch {
        // Corrupt session.json isolated safely without breaking the listing
      }
    }

    // Sort by most recent activity descending
    return summaries.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  async getSession(idOrSlug: string): Promise<FullSession> {
    const { dir, session } = await this.resolveSessionDir(idOrSlug);

    const convPath = path.join(dir, "conversation.json");
    let conversation: Conversation = {
      sessionId: session.id,
      messages: [],
      updatedAt: session.updatedAt,
    };
    if (existsSync(convPath)) {
      try {
        conversation = JSON.parse(await readFile(convPath, "utf-8"));
      } catch {
        // Fallback to empty conversation if corrupt
      }
    }

    const promptPath = path.join(dir, "prompt.snapshot.txt");
    let promptSnapshot = "";
    if (existsSync(promptPath)) {
      promptSnapshot = await readFile(promptPath, "utf-8");
    }

    const configPath = path.join(dir, "generation-config.json");
    let generationConfig: GenerationConfig = {
      providerId: session.providerId,
      modelId: session.modelId,
      styleId: session.styleId,
      candidateCount: 1,
      width: session.dimensions?.width ?? 1024,
      height: session.dimensions?.height ?? 1024,
      outputFormat: "png",
      createdAt: session.createdAt,
    };
    if (existsSync(configPath)) {
      try {
        generationConfig = JSON.parse(await readFile(configPath, "utf-8"));
      } catch {
        // Fallback to reconstructed generationConfig
      }
    }

    const readArtifacts = async (sub: string): Promise<string[]> => {
      const subDir = path.join(dir, sub);
      if (!existsSync(subDir)) return [];
      const files = await readdir(subDir);
      return files.filter((f) => !f.startsWith("."));
    };

    const artifacts: SessionArtifacts = {
      images: await readArtifacts("images"),
      source: await readArtifacts("source"),
      svg: await readArtifacts("svg"),
      assets: await readArtifacts("assets"),
    };

    if (session.candidates) {
      session.candidates = session.candidates.map((c) =>
        hydrateCandidateVersions(c, promptSnapshot),
      );
    }

    return {
      session,
      conversation,
      promptSnapshot,
      generationConfig,
      artifacts,
    };
  }

  async updateSession(
    idOrSlug: string,
    updates: UpdateSessionData,
  ): Promise<Session> {
    const { dir, session } = await this.resolveSessionDir(idOrSlug);
    let changed = false;

    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) {
        throw new SessionError(
          "INVALID_SESSION_NAME",
          "Session name cannot be empty",
        );
      }
      if (trimmed.length > 100) {
        throw new SessionError(
          "INVALID_SESSION_NAME",
          "Session name exceeds maximum length of 100 characters",
        );
      }
      session.name = trimmed;
      changed = true;
    }

    if (updates.providerId !== undefined) {
      const trimmed = updates.providerId.trim();
      if (!trimmed) {
        throw new SessionError(
          "INVALID_SESSION_NAME",
          "Provider ID cannot be empty",
        );
      }
      session.providerId = trimmed;
      changed = true;
    }

    if (updates.modelId !== undefined) {
      const trimmed = updates.modelId.trim();
      if (!trimmed) {
        throw new SessionError(
          "INVALID_SESSION_NAME",
          "Model ID cannot be empty",
        );
      }
      session.modelId = trimmed;
      changed = true;
    }

    if (changed) {
      session.updatedAt = new Date().toISOString();
      await atomicWriteJson(path.join(dir, "session.json"), session);

      if (updates.providerId !== undefined || updates.modelId !== undefined) {
        const configPath = path.join(dir, "generation-config.json");
        let generationConfig: GenerationConfig;
        if (existsSync(configPath)) {
          try {
            generationConfig = JSON.parse(await readFile(configPath, "utf-8"));
          } catch {
            generationConfig = {
              providerId: session.providerId,
              modelId: session.modelId,
              styleId: session.styleId,
              candidateCount: 1,
              width: session.dimensions?.width ?? 1024,
              height: session.dimensions?.height ?? 1024,
              outputFormat: "png",
              createdAt: session.createdAt,
            };
          }
        } else {
          generationConfig = {
            providerId: session.providerId,
            modelId: session.modelId,
            styleId: session.styleId,
            candidateCount: 1,
            width: session.dimensions?.width ?? 1024,
            height: session.dimensions?.height ?? 1024,
            outputFormat: "png",
            createdAt: session.createdAt,
          };
        }

        if (updates.providerId !== undefined) {
          generationConfig.providerId = session.providerId;
        }
        if (updates.modelId !== undefined) {
          generationConfig.modelId = session.modelId;
        }

        await atomicWriteJson(configPath, generationConfig);
      }
    }

    return session;
  }

  async renameSession(idOrSlug: string, newName: string): Promise<Session> {
    return this.updateSession(idOrSlug, { name: newName });
  }

  async deleteSession(idOrSlug: string): Promise<void> {
    const { dir } = await this.resolveSessionDir(idOrSlug);
    await rm(dir, { recursive: true, force: true });
  }

  async saveArtifact(
    idOrSlug: string,
    type: "images" | "source" | "svg" | "assets",
    filename: string,
    content: string | Uint8Array,
  ): Promise<string> {
    return this.withSessionWriteLock(async () => {
      const { dir, session } = await this.resolveSessionDir(idOrSlug);
      const artifactPath = validateArtifactPath(
        this.baseDir,
        session.slug,
        type,
        filename,
      );

      if (existsSync(artifactPath)) {
        throw new SessionError(
          "IMMUTABLE_ARTIFACT",
          `Artifact '${filename}' already exists and cannot be overwritten`,
        );
      }

      await atomicWriteFile(artifactPath, content);

      // Re-read latest session.json to avoid overwriting concurrently saved candidates
      const latestRaw = await readFile(path.join(dir, "session.json"), "utf-8");
      const latestSession = JSON.parse(latestRaw) as Session;
      latestSession.updatedAt = new Date().toISOString();
      await atomicWriteJson(path.join(dir, "session.json"), latestSession);

      return artifactPath;
    });
  }

  async getArtifactPath(
    idOrSlug: string,
    type: string,
    filename: string,
  ): Promise<{ filePath: string; mimeType: string }> {
    const { session } = await this.resolveSessionDir(idOrSlug);
    const artifactPath = validateArtifactPath(
      this.baseDir,
      session.slug,
      type,
      filename,
    );

    if (!existsSync(artifactPath)) {
      throw new SessionError(
        "ARTIFACT_NOT_FOUND",
        `Artifact '${filename}' not found`,
      );
    }

    return {
      filePath: artifactPath,
      mimeType: getMimeType(filename),
    };
  }

  async savePromptSnapshot(
    idOrSlug: string,
    snapshotContent: string,
  ): Promise<void> {
    const { dir } = await this.resolveSessionDir(idOrSlug);
    await atomicWriteFile(
      path.join(dir, "prompt.snapshot.txt"),
      snapshotContent,
    );
  }

  async saveCandidate(
    idOrSlug: string,
    candidate: Candidate,
  ): Promise<Session> {
    return this.withSessionWriteLock(async () => {
      const { dir, session } = await this.resolveSessionDir(idOrSlug);
      const candidates = session.candidates ?? [];
      const existingIdx = candidates.findIndex((c) => c.id === candidate.id);

      if (existingIdx !== -1) {
        candidates[existingIdx] = candidate;
      } else {
        candidates.push(candidate);
      }

      session.candidates = candidates;
      session.updatedAt = new Date().toISOString();

      await atomicWriteJson(path.join(dir, "session.json"), session);
      return session;
    });
  }

  async recordBatchSummary(
    idOrSlug: string,
    summary: BatchSummary,
    finalCandidates?: Candidate[],
  ): Promise<Session> {
    return this.withSessionWriteLock(async () => {
      const { dir, session } = await this.resolveSessionDir(idOrSlug);
      session.activeBatchId = summary.batchId;
      session.lastBatchStatus = summary.status;
      session.lastBatchSummary = summary;
      if (finalCandidates) {
        const candidates = session.candidates ? [...session.candidates] : [];
        for (const candidate of finalCandidates) {
          const existingIdx = candidates.findIndex(
            (c) => c.id === candidate.id,
          );
          if (existingIdx !== -1) {
            candidates[existingIdx] = candidate;
          } else {
            candidates.push(candidate);
          }
        }
        session.candidates = candidates;
      }
      session.updatedAt = new Date().toISOString();

      await atomicWriteJson(path.join(dir, "session.json"), session);
      return session;
    });
  }

  async appendConversationMessage(
    idOrSlug: string,
    message: ConversationMessage,
  ): Promise<Conversation> {
    return this.withSessionWriteLock(async () => {
      const { dir, session } = await this.resolveSessionDir(idOrSlug);
      const convPath = path.join(dir, "conversation.json");
      let conversation: Conversation = {
        sessionId: session.id,
        messages: [],
        updatedAt: session.updatedAt,
      };
      if (existsSync(convPath)) {
        try {
          conversation = JSON.parse(await readFile(convPath, "utf-8"));
        } catch {
          // Fallback to empty conversation if corrupt
        }
      }

      conversation.messages.push(message);
      conversation.updatedAt = new Date().toISOString();
      await atomicWriteJson(convPath, conversation);

      const latestRaw = await readFile(path.join(dir, "session.json"), "utf-8");
      const latestSession = JSON.parse(latestRaw) as Session;
      latestSession.updatedAt = conversation.updatedAt;
      await atomicWriteJson(path.join(dir, "session.json"), latestSession);

      return conversation;
    });
  }

  async getCandidates(idOrSlug: string): Promise<Candidate[]> {
    const { dir, session } = await this.resolveSessionDir(idOrSlug);
    let promptSnapshot = "";
    const promptPath = path.join(dir, "prompt.snapshot.txt");
    if (existsSync(promptPath)) {
      try {
        promptSnapshot = await readFile(promptPath, "utf-8");
      } catch {
        // Ignore read error
      }
    }
    return (session.candidates ?? []).map((c) =>
      hydrateCandidateVersions(c, promptSnapshot),
    );
  }
}
