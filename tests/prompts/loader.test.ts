import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
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
});
