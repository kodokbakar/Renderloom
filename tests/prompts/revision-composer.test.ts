import { describe, expect, test } from "bun:test";
import { MAX_PROMPT_LENGTH } from "../../src/domain/dimensions";
import { ValidationError } from "../../src/domain/errors";
import type { ConversationMessage } from "../../src/domain/session";
import { composeRevisionPrompt } from "../../src/prompts/revision-composer";

describe("composeRevisionPrompt", () => {
  const validJsx = `<div style={{ display: 'flex', width: 1024, height: 1024, backgroundColor: '#ffffff', color: '#000000', padding: 40 }}>
  <h1 style={{ fontSize: 48, fontWeight: 700 }}>Minimalist Design</h1>
</div>`;

  test("composes valid revision prompt with current JSX and style constraints", async () => {
    const composed = await composeRevisionPrompt({
      candidateId: "design-001",
      currentJsx: validJsx,
      revisionPrompt:
        "Change background color to deep navy and increase title font size to 64px",
      styleId: "swiss",
      width: 1024,
      height: 1024,
      parentVersionId: "v001",
    });

    expect(composed.systemPrompt).toContain("Swiss International");
    expect(composed.systemPrompt).toContain("TECHNICAL CONSTRAINTS");
    expect(composed.systemPrompt).toContain("STRUCTURED OUTPUT CONTRACT");
    expect(composed.userPrompt).toContain("### USER REVISION REQUEST");
    expect(composed.userPrompt).toContain(
      "Target Candidate: design-001 (Parent Version: v001)",
    );
    expect(composed.userPrompt).toContain("### CURRENT CANDIDATE JSX:");
    expect(composed.userPrompt).toContain(validJsx);
    expect(composed.userPrompt).toContain(
      "Change background color to deep navy and increase title font size to 64px",
    );
    expect(composed.metadata.candidateId).toBe("design-001");
    expect(composed.metadata.parentVersionId).toBe("v001");
  });

  test("includes bounded conversation context filtered by candidate", async () => {
    const conversationMessages: ConversationMessage[] = [
      {
        id: "msg-1",
        role: "user",
        content: "Create a modern event poster",
        timestamp: "2026-10-24T10:00:00.000Z",
      },
      {
        id: "msg-2",
        role: "assistant",
        content: "Generated 3 candidate designs",
        timestamp: "2026-10-24T10:00:05.000Z",
      },
      {
        id: "msg-3",
        role: "user",
        content: "Revise candidate 2 to be yellow",
        timestamp: "2026-10-24T10:01:00.000Z",
        candidateId: "design-002",
      },
      {
        id: "msg-4",
        role: "user",
        content: "Revise candidate 1 with bold typography",
        timestamp: "2026-10-24T10:02:00.000Z",
        candidateId: "design-001",
      },
      {
        id: "msg-5",
        role: "assistant",
        content: "Updated candidate 1 typography",
        timestamp: "2026-10-24T10:02:05.000Z",
        candidateId: "design-001",
      },
    ];

    const composed = await composeRevisionPrompt({
      candidateId: "design-001",
      currentJsx: validJsx,
      revisionPrompt: "Now add a subtitled date at the bottom",
      styleId: "swiss",
      conversationMessages,
    });

    expect(composed.userPrompt).toContain("### RELEVANT CONVERSATION CONTEXT:");
    expect(composed.userPrompt).toContain(
      "User: Revise candidate 1 with bold typography",
    );
    expect(composed.userPrompt).toContain(
      "Assistant: Updated candidate 1 typography",
    );
    // design-002 revision message should be filtered out
    expect(composed.userPrompt).not.toContain(
      "Revise candidate 2 to be yellow",
    );
  });

  test("throws ValidationError on empty revision prompt", async () => {
    expect(
      composeRevisionPrompt({
        candidateId: "design-001",
        currentJsx: validJsx,
        revisionPrompt: "   ",
        styleId: "swiss",
      }),
    ).rejects.toThrow(ValidationError);
  });

  test("throws ValidationError on empty currentJsx", async () => {
    expect(
      composeRevisionPrompt({
        candidateId: "design-001",
        currentJsx: "   ",
        revisionPrompt: "Change color",
        styleId: "swiss",
      }),
    ).rejects.toThrow(ValidationError);
  });

  test("throws ValidationError on empty candidateId", async () => {
    expect(
      composeRevisionPrompt({
        candidateId: "",
        currentJsx: validJsx,
        revisionPrompt: "Change color",
        styleId: "swiss",
      }),
    ).rejects.toThrow(ValidationError);
  });

  test("throws ValidationError when revision prompt exceeds MAX_PROMPT_LENGTH", async () => {
    const oversizedPrompt = "A".repeat(MAX_PROMPT_LENGTH + 10);
    expect(
      composeRevisionPrompt({
        candidateId: "design-001",
        currentJsx: validJsx,
        revisionPrompt: oversizedPrompt,
        styleId: "swiss",
      }),
    ).rejects.toThrow(ValidationError);
  });
});
