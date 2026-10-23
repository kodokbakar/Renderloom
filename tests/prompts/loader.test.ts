import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { composePrompt } from "../../src/prompts/composer";
import {
  DEFAULT_BASE_PROMPT,
  loadBasePrompt,
  snapshotPrompt,
} from "../../src/prompts/loader";
import { SessionService } from "../../src/sessions/service";

describe("Base Prompt Loader & Immutability", () => {
  test("loads project base prompt.txt successfully", async () => {
    const prompt = await loadBasePrompt();
    expect(prompt).toContain("You are an expert graphic designer");
    expect(prompt).toContain("Satori");
  });

  test("falls back to DEFAULT_BASE_PROMPT when file is missing", async () => {
    const prompt = await loadBasePrompt("/path/to/nonexistent/prompt.txt");
    expect(prompt).toBe(DEFAULT_BASE_PROMPT);
  });

  test("loads from custom path when specified", async () => {
    const tempDir = path.join(
      process.cwd(),
      "Outputs",
      `test-prompt-loader-${Date.now()}`,
    );
    mkdirSync(tempDir, { recursive: true });
    const customPromptPath = path.join(tempDir, "custom.txt");

    try {
      writeFileSync(customPromptPath, "Custom visual instructions");
      const loaded = await loadBasePrompt(customPromptPath);
      expect(loaded).toBe("Custom visual instructions");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("snapshot is immutable even if source prompt file changes later", async () => {
    const tempDir = path.join(
      process.cwd(),
      "Outputs",
      `test-prompt-immutability-${Date.now()}`,
    );
    mkdirSync(tempDir, { recursive: true });
    const promptPath = path.join(tempDir, "prompt.txt");

    try {
      writeFileSync(promptPath, "Version 1 Instructions");
      const snapshotV1 = await snapshotPrompt(promptPath);
      expect(snapshotV1).toBe("Version 1 Instructions");

      // Now change the prompt file
      writeFileSync(promptPath, "Version 2 Instructions");

      // Verify old snapshot didn't change
      expect(snapshotV1).toBe("Version 1 Instructions");

      // New snapshot reflects the updated file
      const snapshotV2 = await snapshotPrompt(promptPath);
      expect(snapshotV2).toBe("Version 2 Instructions");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("session captures prompt snapshot that remains stable when prompt.txt changes", async () => {
    const tempOutputs = path.join(
      process.cwd(),
      "Outputs",
      `test-session-prompt-snap-${Date.now()}`,
    );
    const service = new SessionService(tempOutputs);

    try {
      const session = await service.createSession(
        {
          name: "Prompt Snapshot Session",
          providerId: "openai",
          modelId: "gpt-4o",
          styleId: "bauhaus",
          width: 1024,
          height: 1024,
        },
        "",
        "Effective Base Prompt Snapshot at T0",
      );

      const snapPath = path.join(
        tempOutputs,
        session.slug,
        "prompt.snapshot.txt",
      );
      expect(readFileSync(snapPath, "utf-8")).toBe(
        "Effective Base Prompt Snapshot at T0",
      );

      // Even if another snapshot is created later or default prompt changes, session file is intact
      const fullSession = await service.getSession(session.id);
      expect(fullSession.promptSnapshot).toBe(
        "Effective Base Prompt Snapshot at T0",
      );
    } finally {
      rmSync(tempOutputs, { recursive: true, force: true });
    }
  });

  test("changing prompt.txt affects subsequent generations without silently changing an existing session's saved snapshot", async () => {
    const tempDir = path.join(
      process.cwd(),
      "Outputs",
      `test-prompt-lifecycle-${Date.now()}`,
    );
    mkdirSync(tempDir, { recursive: true });
    const promptFile = path.join(tempDir, "prompt.txt");
    const outputsDir = path.join(tempDir, "sessions");
    mkdirSync(outputsDir, { recursive: true });

    try {
      // T0: Initial prompt version
      writeFileSync(
        promptFile,
        "Base Prompt Version T0 (Initial Instructions)",
      );
      const initialSnapshot = await snapshotPrompt(promptFile);

      const service = new SessionService(outputsDir);
      const session1 = await service.createSession(
        {
          name: "Session Alpha",
          providerId: "openai",
          modelId: "gpt-4o",
          styleId: "bauhaus",
          width: 1024,
          height: 1024,
        },
        "",
        initialSnapshot,
      );

      // Verify session 1 snapshot recorded T0
      const session1Loaded = await service.getSession(session1.id);
      expect(session1Loaded.promptSnapshot).toBe(
        "Base Prompt Version T0 (Initial Instructions)",
      );

      // Subsequent compose at T0 uses T0
      const comp1 = await composePrompt({
        prompt: "First request",
        styleId: "bauhaus",
        customBasePromptPath: promptFile,
      });
      expect(comp1.systemPrompt).toContain(
        "Base Prompt Version T0 (Initial Instructions)",
      );

      // T1: prompt.txt is modified on disk
      writeFileSync(
        promptFile,
        "Base Prompt Version T1 (Updated Rules for Future Designs)",
      );

      // Subsequent compose at T1 automatically reflects the modified prompt.txt
      const comp2 = await composePrompt({
        prompt: "Second request after prompt.txt edit",
        styleId: "bauhaus",
        customBasePromptPath: promptFile,
      });
      expect(comp2.systemPrompt).toContain(
        "Base Prompt Version T1 (Updated Rules for Future Designs)",
      );
      expect(comp2.systemPrompt).not.toContain(
        "Base Prompt Version T0 (Initial Instructions)",
      );

      // A new session created at T1 captures the new snapshot
      const updatedSnapshot = await snapshotPrompt(promptFile);
      const session2 = await service.createSession(
        {
          name: "Session Beta",
          providerId: "openai",
          modelId: "gpt-4o",
          styleId: "bauhaus",
          width: 1024,
          height: 1024,
        },
        "",
        updatedSnapshot,
      );
      const session2Loaded = await service.getSession(session2.id);
      expect(session2Loaded.promptSnapshot).toBe(
        "Base Prompt Version T1 (Updated Rules for Future Designs)",
      );

      // CRUCIAL: Verify existing Session 1 saved snapshot on disk was NOT silently changed
      const session1Rechecked = await service.getSession(session1.id);
      expect(session1Rechecked.promptSnapshot).toBe(
        "Base Prompt Version T0 (Initial Instructions)",
      );
      const session1FileDisk = readFileSync(
        path.join(outputsDir, session1.slug, "prompt.snapshot.txt"),
        "utf-8",
      );
      expect(session1FileDisk).toBe(
        "Base Prompt Version T0 (Initial Instructions)",
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
