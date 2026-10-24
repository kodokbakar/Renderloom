import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
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
  });
});
