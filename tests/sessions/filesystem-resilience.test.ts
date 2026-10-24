import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync } from "node:fs";
import * as fsPromises from "node:fs/promises";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Candidate, CreateSessionRequest } from "../../src/domain";
import {
  atomicWriteFile,
  atomicWriteJson,
  cleanupOrphanedTempFiles,
} from "../../src/sessions/atomic";
import { SessionService } from "../../src/sessions/service";

describe("Filesystem Resilience and Interrupted Write Suite", () => {
  let tempBaseDir: string;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(path.join(tmpdir(), "renderloom-resilience-"));
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  describe("Simulated ENOSPC (Disk Full)", () => {
    test("preserves pre-existing target file and unlinks temp file on ENOSPC", async () => {
      const targetPath = path.join(tempBaseDir, "critical-data.json");
      const initialContent = JSON.stringify({ version: 1, status: "healthy" });
      await writeFile(targetPath, initialContent, "utf-8");

      // Spy on fsPromises.writeFile to throw ENOSPC
      const origWriteFile = fsPromises.writeFile;
      const writeSpy = spyOn(fsPromises, "writeFile").mockImplementation(
        async (file, data, ...rest) => {
          if (typeof file === "string" && file.endsWith(".tmp")) {
            const err = new Error("ENOSPC: no space left on device");
            (err as unknown as { code: string }).code = "ENOSPC";
            throw err;
          }
          return origWriteFile(file, data, ...rest);
        },
      );

      try {
        const corruptingPayload = JSON.stringify({
          version: 2,
          status: "overwritten",
        });
        await expect(
          atomicWriteFile(targetPath, corruptingPayload),
        ).rejects.toThrow("ENOSPC");

        // Verify pre-existing destination file survives untouched
        const preservedContent = await readFile(targetPath, "utf-8");
        expect(preservedContent).toBe(initialContent);

        // Verify no leftover .tmp files
        const dirEntries = await readdir(tempBaseDir);
        const tempFiles = dirEntries.filter(
          (f) => f.startsWith(".") && f.endsWith(".tmp"),
        );
        expect(tempFiles.length).toBe(0);
      } finally {
        writeSpy.mockRestore();
      }
    });

    test("atomicWriteJson preserves destination on ENOSPC failure", async () => {
      const targetPath = path.join(tempBaseDir, "session.json");
      const validSession = { id: "sess-1", name: "Safe Session", safe: true };
      await atomicWriteJson(targetPath, validSession);

      const writeSpy = spyOn(fsPromises, "writeFile").mockImplementation(
        async () => {
          const err = new Error("ENOSPC: no space left on device");
          (err as unknown as { code: string }).code = "ENOSPC";
          throw err;
        },
      );

      try {
        await expect(
          atomicWriteJson(targetPath, { id: "sess-1", destroyed: true }),
        ).rejects.toThrow("ENOSPC");

        const preserved = JSON.parse(await readFile(targetPath, "utf-8"));
        expect(preserved.safe).toBe(true);
        expect(preserved.destroyed).toBeUndefined();
      } finally {
        writeSpy.mockRestore();
      }
    });
  });

  describe("Simulated EACCES (Permission Denied)", () => {
    test("handles write permission errors without corrupting target", async () => {
      const targetPath = path.join(tempBaseDir, "protected-file.txt");
      await writeFile(targetPath, "protected original", "utf-8");

      const writeSpy = spyOn(fsPromises, "writeFile").mockImplementation(
        async () => {
          const err = new Error("EACCES: permission denied, open");
          (err as unknown as { code: string }).code = "EACCES";
          throw err;
        },
      );

      try {
        await expect(
          atomicWriteFile(targetPath, "malicious payload"),
        ).rejects.toThrow("EACCES");
        const content = await readFile(targetPath, "utf-8");
        expect(content).toBe("protected original");
      } finally {
        writeSpy.mockRestore();
      }
    });
  });

  describe("Interrupted Write and Orphaned Temp Files", () => {
    test("preserves target and cleans up temp files when write is aborted before rename", async () => {
      const targetPath = path.join(tempBaseDir, "document.jsx");
      await writeFile(targetPath, "<div id='v1' />", "utf-8");

      // Spy on rename to simulate process crash/interruption
      const renameSpy = spyOn(fsPromises, "rename").mockImplementation(
        async () => {
          const err = new Error("EIO: i/o error during rename");
          (err as unknown as { code: string }).code = "EIO";
          throw err;
        },
      );

      try {
        await expect(
          atomicWriteFile(targetPath, "<div id='v2' />"),
        ).rejects.toThrow("EIO");

        // Verify target file untouched
        const content = await readFile(targetPath, "utf-8");
        expect(content).toBe("<div id='v1' />");

        // Simulate orphaned temp file left by an unhandled SIGKILL / abort
        const orphanedTempPath = path.join(
          tempBaseDir,
          ".document.jsx.orphaned-uuid.tmp",
        );
        await writeFile(orphanedTempPath, "abandoned half-written bytes");

        let entries = await readdir(tempBaseDir);
        expect(entries.some((f) => f.endsWith(".tmp"))).toBe(true);

        // Run cleanup
        const cleanedCount = await cleanupOrphanedTempFiles(tempBaseDir);
        expect(cleanedCount).toBeGreaterThanOrEqual(1);

        entries = await readdir(tempBaseDir);
        expect(entries.some((f) => f.endsWith(".tmp"))).toBe(false);
      } finally {
        renameSpy.mockRestore();
      }
    });
  });

  describe("Partial Batch Resilience and Session Reopen", () => {
    test("preserves completed candidate artifacts when subsequent candidate fails", async () => {
      const sessionService = new SessionService(tempBaseDir);

      const request: CreateSessionRequest = {
        name: "Resilience Batch Session",
        providerId: "anthropic",
        modelId: "claude-3-7-sonnet-20250219",
        styleId: "swiss",
        width: 800,
        height: 600,
        aspectRatio: "4:5",
      };

      const session = await sessionService.createSession(request);
      expect(session.id).toBeDefined();

      // Candidate 1 succeeds and writes artifacts
      const cand1Id = "cand-001";
      const cand1Png = path.join("images", `${cand1Id}-v001.png`);
      const cand1Svg = path.join("svg", `${cand1Id}-v001.svg`);
      const cand1Jsx = path.join("source", `${cand1Id}-v001.jsx`);

      await sessionService.saveArtifact(
        session.id,
        "images",
        `${cand1Id}-v001.png`,
        Buffer.from("PNG_DATA_CAND_1"),
      );
      await sessionService.saveArtifact(
        session.id,
        "svg",
        `${cand1Id}-v001.svg`,
        "<svg>CAND_1</svg>",
      );
      await sessionService.saveArtifact(
        session.id,
        "source",
        `${cand1Id}-v001.jsx`,
        "<div>Cand 1</div>",
      );

      const candidate1: Candidate = {
        id: cand1Id,
        sessionId: session.id,
        index: 0,
        label: "Candidate 1",
        state: "completed",
        rationale: "Clean Swiss layout",
        currentVersionId: "v001",
        artifacts: {
          pngPath: cand1Png,
          svgPath: cand1Svg,
          sourcePath: cand1Jsx,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await sessionService.saveCandidate(session.id, candidate1);

      // Candidate 2 starts, but writing its image fails (simulated failure)
      const cand2Id = "cand-002";
      const origWrite = fsPromises.writeFile;
      const writeSpy = spyOn(fsPromises, "writeFile").mockImplementation(
        async (file, data, ...rest) => {
          if (typeof file === "string" && file.includes(cand2Id)) {
            const err = new Error("ENOSPC: disk full during candidate 2");
            (err as unknown as { code: string }).code = "ENOSPC";
            throw err;
          }
          return origWrite(file, data, ...rest);
        },
      );

      try {
        await expect(
          sessionService.saveArtifact(
            session.id,
            "images",
            `${cand2Id}-v001.png`,
            Buffer.from("FAILING_DATA"),
          ),
        ).rejects.toThrow("ENOSPC");

        // Save candidate 2 as failed in session
        const candidate2: Candidate = {
          id: cand2Id,
          sessionId: session.id,
          index: 1,
          label: "Candidate 2",
          state: "failed",
          rationale: "Generation interrupted",
          errorMessage: "ENOSPC: disk full during candidate 2",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await sessionService.saveCandidate(session.id, candidate2);
      } finally {
        writeSpy.mockRestore();
      }

      // Reopen session and assert full integrity
      const reopened = await sessionService.getSession(session.id);
      expect(reopened.session.id).toBe(session.id);
      expect(reopened.session.name).toBe("Resilience Batch Session");
      expect(reopened.session.candidates?.length).toBe(2);

      // Verify Candidate 1 survived intact
      const reopenedCand1 = reopened.session.candidates?.find(
        (c) => c.id === cand1Id,
      );
      expect(reopenedCand1).toBeDefined();
      expect(reopenedCand1?.state).toBe("completed");
      expect(reopenedCand1?.artifacts?.pngPath).toBe(cand1Png);

      // Verify Candidate 1 artifacts on disk are readable and intact
      const cand1PngArtifact = await sessionService.getArtifactPath(
        session.id,
        "images",
        `${cand1Id}-v001.png`,
      );
      const cand1PngContent = await readFile(cand1PngArtifact.filePath);
      expect(cand1PngContent.toString()).toBe("PNG_DATA_CAND_1");

      const cand1SvgArtifact = await sessionService.getArtifactPath(
        session.id,
        "svg",
        `${cand1Id}-v001.svg`,
      );
      const cand1SvgContent = await readFile(
        cand1SvgArtifact.filePath,
        "utf-8",
      );
      expect(cand1SvgContent).toBe("<svg>CAND_1</svg>");

      expect(reopened.artifacts.images).toContain(`${cand1Id}-v001.png`);
      expect(reopened.artifacts.svg).toContain(`${cand1Id}-v001.svg`);
      expect(reopened.artifacts.source).toContain(`${cand1Id}-v001.jsx`);
      // Verify Candidate 2 is recorded as failed
      const reopenedCand2 = reopened.session.candidates?.find(
        (c) => c.id === cand2Id,
      );
      expect(reopenedCand2).toBeDefined();
      expect(reopenedCand2?.state).toBe("failed");
      expect(reopenedCand2?.errorMessage).toContain(
        "disk full during candidate 2",
      );
    });

    test("handles 3-candidate batch where middle candidate fails and surrounding succeed", async () => {
      const sessionService = new SessionService(tempBaseDir);
      const session = await sessionService.createSession({
        name: "3-Candidate Resilience Session",
        providerId: "anthropic",
        modelId: "claude-3-7-sonnet-20250219",
        styleId: "editorial",
        width: 1200,
        height: 630,
        aspectRatio: "16:9",
      });

      // Candidate 1 succeeds
      const c1Id = "cand-101";
      await sessionService.saveArtifact(
        session.id,
        "images",
        `${c1Id}-v001.png`,
        Buffer.from("PNG_101"),
      );
      await sessionService.saveCandidate(session.id, {
        id: c1Id,
        sessionId: session.id,
        index: 0,
        label: "Candidate 1",
        state: "completed",
        artifacts: {
          pngPath: path.join("images", `${c1Id}-v001.png`),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Candidate 2 fails
      const c2Id = "cand-102";
      const origWrite = fsPromises.writeFile;
      const writeSpy = spyOn(fsPromises, "writeFile").mockImplementation(
        async (file, data, ...rest) => {
          if (typeof file === "string" && file.includes(c2Id)) {
            const err = Object.assign(new Error("EIO: hardware write fault"), {
              code: "EIO",
            });
            throw err;
          }
          return origWrite(file, data, ...rest);
        },
      );

      try {
        await expect(
          sessionService.saveArtifact(
            session.id,
            "images",
            `${c2Id}-v001.png`,
            Buffer.from("PNG_102"),
          ),
        ).rejects.toThrow("EIO");

        await sessionService.saveCandidate(session.id, {
          id: c2Id,
          sessionId: session.id,
          index: 1,
          label: "Candidate 2",
          state: "failed",
          errorMessage: "EIO: hardware write fault",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } finally {
        writeSpy.mockRestore();
      }

      // Candidate 3 succeeds
      const c3Id = "cand-103";
      await sessionService.saveArtifact(
        session.id,
        "images",
        `${c3Id}-v001.png`,
        Buffer.from("PNG_103"),
      );
      await sessionService.saveCandidate(session.id, {
        id: c3Id,
        sessionId: session.id,
        index: 2,
        label: "Candidate 3",
        state: "completed",
        artifacts: {
          pngPath: path.join("images", `${c3Id}-v001.png`),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Reopen session
      const reopened = await sessionService.getSession(session.id);
      expect(reopened.session.candidates?.length).toBe(3);

      const c1 = reopened.session.candidates?.[0];
      const c2 = reopened.session.candidates?.[1];
      const c3 = reopened.session.candidates?.[2];

      expect(c1?.id).toBe(c1Id);
      expect(c1?.state).toBe("completed");
      expect(c2?.id).toBe(c2Id);
      expect(c2?.state).toBe("failed");
      expect(c3?.id).toBe(c3Id);
      expect(c3?.state).toBe("completed");

      const p1 = await sessionService.getArtifactPath(
        session.id,
        "images",
        `${c1Id}-v001.png`,
      );
      expect(await readFile(p1.filePath, "utf-8")).toBe("PNG_101");

      const p3 = await sessionService.getArtifactPath(
        session.id,
        "images",
        `${c3Id}-v001.png`,
      );
      expect(await readFile(p3.filePath, "utf-8")).toBe("PNG_103");
    });

    test("recursively cleans up orphaned temp files in nested subdirectories", async () => {
      const subDirA = path.join(tempBaseDir, "images");
      const subDirB = path.join(tempBaseDir, "svg");
      await fsPromises.mkdir(subDirA, { recursive: true });
      await fsPromises.mkdir(subDirB, { recursive: true });

      const orphan1 = path.join(subDirA, ".cand1.png.abc.tmp");
      const orphan2 = path.join(subDirB, ".cand2.svg.xyz.tmp");
      const normal = path.join(subDirA, "healthy.png");

      await writeFile(orphan1, "stale-temp-1");
      await writeFile(orphan2, "stale-temp-2");
      await writeFile(normal, "healthy-file");

      const cleaned = await cleanupOrphanedTempFiles(tempBaseDir);
      expect(cleaned).toBe(2);

      expect(existsSync(orphan1)).toBe(false);
      expect(existsSync(orphan2)).toBe(false);
      expect(existsSync(normal)).toBe(true);
    });
  });
});
