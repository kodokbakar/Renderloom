import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  type CreateSessionRequest,
  type Session,
  SessionError,
  ValidationError,
} from "../../src/domain";
import {
  resolveOutputsDir,
  validateArtifactPath,
  validateSessionPath,
} from "../../src/sessions/paths";
import { SessionService } from "../../src/sessions/service";

describe("Session Edge Cases and Boundary Guards", () => {
  let tempOutputs: string;
  let outsideDir: string;
  let service: SessionService;

  beforeAll(() => {
    tempOutputs = path.join(
      tmpdir(),
      `renderloom-test-edge-cases-${Date.now()}`,
    );
    outsideDir = path.join(
      tmpdir(),
      `renderloom-test-outside-edge-${Date.now()}`,
    );
    mkdirSync(tempOutputs, { recursive: true });
    mkdirSync(outsideDir, { recursive: true });
    service = new SessionService(tempOutputs);
  });

  afterAll(() => {
    rmSync(tempOutputs, { recursive: true, force: true });
    rmSync(outsideDir, { recursive: true, force: true });
  });

  const baseRequest: CreateSessionRequest = {
    name: "Edge Case Session",
    providerId: "openai",
    modelId: "gpt-4o",
    styleId: "bauhaus",
    width: 1024,
    height: 1024,
  };

  describe("Concurrency & Race Conditions", () => {
    test("concurrent creation with distinct names creates all sessions safely", async () => {
      const count = 10;
      const tasks = Array.from({ length: count }, (_, i) =>
        service.createSession(
          { ...baseRequest, name: `Concurrent Session ${i}` },
          `Initial prompt for session ${i}`,
        ),
      );

      const created = await Promise.all(tasks);
      expect(created.length).toBe(count);

      const slugs = new Set(created.map((s) => s.slug));
      expect(slugs.size).toBe(count);

      const list = await service.listSessions();
      for (const item of created) {
        expect(list.some((s) => s.id === item.id)).toBe(true);
      }
    });

    test("concurrent creation with identical names does not overwrite or corrupt", async () => {
      const duplicateName = "Identical Race Poster";
      const tasks = Array.from({ length: 5 }, () =>
        service.createSession({ ...baseRequest, name: duplicateName }),
      );

      // Settle all promises; some may succeed with unique suffixes, or safely conflict
      const results = await Promise.allSettled(tasks);
      const successful = results
        .filter(
          (r): r is PromiseFulfilledResult<Session> => r.status === "fulfilled",
        )
        .map((r) => r.value);

      expect(successful.length).toBeGreaterThanOrEqual(1);

      // Verify all successfully created sessions have distinct slugs and valid JSON files
      const successfulSlugs = new Set(successful.map((s) => s.slug));
      expect(successfulSlugs.size).toBe(successful.length);

      for (const s of successful) {
        const sessionFile = path.join(tempOutputs, s.slug, "session.json");
        expect(existsSync(sessionFile)).toBe(true);
        const parsed = JSON.parse(readFileSync(sessionFile, "utf-8"));
        expect(parsed.id).toBe(s.id);
      }
    });

    test("concurrent artifact writes for different filenames all succeed", async () => {
      const sess = await service.createSession({
        ...baseRequest,
        name: "Concurrent Artifacts",
      });

      const writeTasks = Array.from({ length: 8 }, (_, i) =>
        service.saveArtifact(
          sess.id,
          "images",
          `design-001-v00${i + 1}.png`,
          new Uint8Array([0x89, 0x50, 0x4e, 0x47, i]),
        ),
      );

      await Promise.all(writeTasks);

      const full = await service.getSession(sess.id);
      expect(full.artifacts.images.length).toBe(8);
    });

    test("high-concurrency creation with 20 identical names all succeed with unique slugs", async () => {
      const duplicateName = "Stress Concurrent Poster";
      const count = 20;
      const tasks = Array.from({ length: count }, () =>
        service.createSession({ ...baseRequest, name: duplicateName }),
      );

      const results = await Promise.all(tasks);
      expect(results.length).toBe(count);

      const slugs = new Set(results.map((s) => s.slug));
      expect(slugs.size).toBe(count);

      const ids = new Set(results.map((s) => s.id));
      expect(ids.size).toBe(count);

      for (const s of results) {
        const sessionFile = path.join(tempOutputs, s.slug, "session.json");
        expect(existsSync(sessionFile)).toBe(true);
        const parsed = JSON.parse(readFileSync(sessionFile, "utf-8"));
        expect(parsed.id).toBe(s.id);
        expect(parsed.name).toBe(duplicateName);
      }
    });

    test("concurrent creations interleaved with concurrent listSessions do not crash or corrupt", async () => {
      const createTasks = Array.from({ length: 10 }, (_, i) =>
        service.createSession({
          ...baseRequest,
          name: `Interleaved Session ${i}`,
        }),
      );
      const listTasks = Array.from({ length: 10 }, () =>
        service.listSessions(),
      );

      const [created, listed] = await Promise.all([
        Promise.all(createTasks),
        Promise.all(listTasks),
      ]);

      expect(created.length).toBe(10);
      expect(listed.length).toBe(10);
      for (const list of listed) {
        expect(Array.isArray(list)).toBe(true);
      }
    });
  });

  describe("Symlink & Path Boundary Attacks", () => {
    test("detects and blocks artifact symlinks pointing outside outputs boundary", () => {
      const sessionDir = path.join(tempOutputs, "symlink-artifact-test");
      mkdirSync(path.join(sessionDir, "images"), { recursive: true });

      const targetFile = path.join(outsideDir, "secret-outside.png");
      writeFileSync(targetFile, "secret external data");

      const linkPath = path.join(sessionDir, "images", "escaped-artifact.png");
      try {
        symlinkSync(targetFile, linkPath, "file");
      } catch {
        // Skip if environment does not support symlinks
        return;
      }

      expect(() =>
        validateArtifactPath(
          tempOutputs,
          "symlink-artifact-test",
          "images",
          "escaped-artifact.png",
        ),
      ).toThrow(SessionError);
    });

    test("rejects filenames with dangerous characters and injection vectors", () => {
      const unsafeFilenames = [
        "render;rm.png",
        "render&calc.png",
        "render|cat.png",
        "render$VAR.png",
        "render`id`.png",
        "render name with spaces.png",
        "render\nnewline.png",
        "render\tindent.png",
        "render<test>.png",
        'render"quote".png',
        "render'single'.png",
        "render?param=1.png",
        "render#hash.png",
        ".hidden-file.png",
        "file\0nullbyte.png",
        "sub/folder/file.png",
        "sub\\folder\\file.png",
        "..",
        "../file.png",
      ];

      for (const badName of unsafeFilenames) {
        expect(() =>
          validateArtifactPath(tempOutputs, "valid-slug", "images", badName),
        ).toThrow(SessionError);
      }
    });

    test("allows safe filenames with dashes, underscores, and dots", () => {
      const safeNames = [
        "design-001-v001.png",
        "poster_preview_v2.svg",
        "layout.card.final.jsx",
        "render-123_456.min.png",
      ];

      for (const safe of safeNames) {
        const validated = validateArtifactPath(
          tempOutputs,
          "valid-slug",
          "images",
          safe,
        );
        expect(validated).toBe(
          path.join(tempOutputs, "valid-slug", "images", safe),
        );
      }
    });
  });

  describe("Metadata Recovery & Malformed State Handling", () => {
    test("getSession recovers gracefully when conversation.json is corrupt", async () => {
      const sess = await service.createSession(
        { ...baseRequest, name: "Corrupt Conv Session" },
        "My prompt",
      );

      // Corrupt conversation.json
      const convPath = path.join(tempOutputs, sess.slug, "conversation.json");
      writeFileSync(convPath, "{ bad corrupt json content !!");

      const loaded = await service.getSession(sess.id);
      expect(loaded.session.id).toBe(sess.id);
      expect(loaded.conversation.messages).toEqual([]);
    });

    test("getSession recovers gracefully when generation-config.json is corrupt", async () => {
      const sess = await service.createSession({
        ...baseRequest,
        name: "Corrupt Config Session",
      });

      // Corrupt generation-config.json
      const configPath = path.join(
        tempOutputs,
        sess.slug,
        "generation-config.json",
      );
      writeFileSync(configPath, "[not valid json");

      const loaded = await service.getSession(sess.id);
      expect(loaded.session.id).toBe(sess.id);
      expect(loaded.generationConfig.styleId).toBe(sess.styleId);
      expect(loaded.generationConfig.width).toBe(sess.dimensions.width);
      expect(loaded.generationConfig.height).toBe(sess.dimensions.height);
    });

    test("getSession recovers gracefully when prompt.snapshot.txt is missing", async () => {
      const sess = await service.createSession({
        ...baseRequest,
        name: "Missing Prompt Session",
      });

      const promptPath = path.join(
        tempOutputs,
        sess.slug,
        "prompt.snapshot.txt",
      );
      if (existsSync(promptPath)) {
        unlinkSync(promptPath);
      }

      const loaded = await service.getSession(sess.id);
      expect(loaded.promptSnapshot).toBe("");
    });

    test("listSessions ignores non-directory entries and directories without session.json", async () => {
      // Create a stray file in Outputs/
      writeFileSync(path.join(tempOutputs, "stray-file.txt"), "hello");

      // Create an empty folder
      mkdirSync(path.join(tempOutputs, "empty-folder"), { recursive: true });

      // Create a folder with missing required fields in session.json
      const incompleteDir = path.join(tempOutputs, "incomplete-folder");
      mkdirSync(incompleteDir, { recursive: true });
      writeFileSync(
        path.join(incompleteDir, "session.json"),
        JSON.stringify({ someKey: 123 }),
      );

      const list = await service.listSessions();
      expect(list.some((s) => s.slug === "empty-folder")).toBe(false);
      expect(list.some((s) => s.slug === "incomplete-folder")).toBe(false);
    });

    test("getSession filters out temporary and hidden files from artifact lists", async () => {
      const sess = await service.createSession({
        ...baseRequest,
        name: "Hidden Artifacts Filter",
      });

      await service.saveArtifact(
        sess.id,
        "images",
        "design-001.png",
        "valid png",
      );

      // Write hidden temp files
      const imagesDir = path.join(tempOutputs, sess.slug, "images");
      writeFileSync(path.join(imagesDir, ".design-001.png.tmp"), "temp data");
      writeFileSync(path.join(imagesDir, ".DS_Store"), "junk");

      const loaded = await service.getSession(sess.id);
      expect(loaded.artifacts.images).toEqual(["design-001.png"]);
    });
  });

  describe("Secret Redaction Enforcement in Session Workflows", () => {
    test("rejects session creation when initialPrompt contains API key", async () => {
      const secretPrompt =
        "Generate a poster using key sk-proj-123456789012345678901234567890";

      expect(
        service.createSession(
          { ...baseRequest, name: "Secret Prompt Session" },
          secretPrompt,
        ),
      ).rejects.toThrow(ValidationError);
    });
  });
});
