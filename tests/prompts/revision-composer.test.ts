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
    expect(composed.userPrompt).toContain(
      "Level 1: Content & Text Replacement",
    );
    expect(composed.userPrompt).toContain(
      "Level 2: Structural & Layout Restructuring",
    );
    expect(composed.userPrompt).toContain(
      "Level 3: Styling & Aesthetic Adjustments",
    );
    expect(composed.userPrompt).toContain(
      "Level 4: Preservation of Unmodified Elements",
    );
    expect(composed.metadata.candidateId).toBe("design-001");
    expect(composed.metadata.parentVersionId).toBe("v001");
  });

  test("enforces 4-level directive hierarchy for revision prompt composition", async () => {
    const composed = await composeRevisionPrompt({
      candidateId: "design-hierarchy-01",
      currentJsx: validJsx,
      revisionPrompt: "Update header text and change accent color to orange",
      styleId: "bauhaus",
    });

    expect(composed.userPrompt).toContain(
      "REVISION DIRECTIVE HIERARCHY (Apply in strict priority order):",
    );
    expect(composed.userPrompt).toContain(
      "Level 1: Content & Text Replacement",
    );
    expect(composed.userPrompt).toContain(
      "Level 2: Structural & Layout Restructuring",
    );
    expect(composed.userPrompt).toContain(
      "Level 3: Styling & Aesthetic Adjustments",
    );
    expect(composed.userPrompt).toContain(
      "Level 4: Preservation of Unmodified Elements",
    );
    expect(composed.userPrompt).toContain(
      "Preserve explicit flex container properties",
    );
    expect(composed.userPrompt).toContain(
      "Strictly preserve all existing layout structures",
    );
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

  test("bounds conversation context to at most 4 most recent messages", async () => {
    const messages: ConversationMessage[] = [
      {
        id: "m1",
        role: "user",
        content: "Message 1",
        timestamp: "2026-10-24T10:00:00.000Z",
        candidateId: "design-001",
      },
      {
        id: "m2",
        role: "assistant",
        content: "Message 2",
        timestamp: "2026-10-24T10:01:00.000Z",
        candidateId: "design-001",
      },
      {
        id: "m3",
        role: "user",
        content: "Message 3",
        timestamp: "2026-10-24T10:02:00.000Z",
        candidateId: "design-001",
      },
      {
        id: "m4",
        role: "assistant",
        content: "Message 4",
        timestamp: "2026-10-24T10:03:00.000Z",
        candidateId: "design-001",
      },
      {
        id: "m5",
        role: "user",
        content: "Message 5",
        timestamp: "2026-10-24T10:04:00.000Z",
        candidateId: "design-001",
      },
      {
        id: "m6",
        role: "assistant",
        content: "Message 6",
        timestamp: "2026-10-24T10:05:00.000Z",
        candidateId: "design-001",
      },
    ];

    const composed = await composeRevisionPrompt({
      candidateId: "design-001",
      currentJsx: validJsx,
      revisionPrompt: "Update colors",
      styleId: "swiss",
      conversationMessages: messages,
    });

    expect(composed.userPrompt).not.toContain("User: Message 1");
    expect(composed.userPrompt).not.toContain("Assistant: Message 2");
    expect(composed.userPrompt).toContain("User: Message 3");
    expect(composed.userPrompt).toContain("Assistant: Message 4");
    expect(composed.userPrompt).toContain("User: Message 5");
    expect(composed.userPrompt).toContain("Assistant: Message 6");
  });

  test("truncates message content exceeding 300 characters with ellipsis", async () => {
    const longContent = "A".repeat(400);
    const messages: ConversationMessage[] = [
      {
        id: "m-long",
        role: "user",
        content: longContent,
        timestamp: "2026-10-24T10:00:00.000Z",
        candidateId: "design-001",
      },
    ];

    const composed = await composeRevisionPrompt({
      candidateId: "design-001",
      currentJsx: validJsx,
      revisionPrompt: "Update colors",
      styleId: "swiss",
      conversationMessages: messages,
    });

    expect(composed.userPrompt).toContain(`User: ${"A".repeat(300)}...`);
    expect(composed.userPrompt).not.toContain("A".repeat(301));
  });

  test("handles special characters, unicode, quotes, and HTML-like tags safely", async () => {
    const specialPrompt = `Add a "quote", 'single', <Header> tag, \\slash & emoji: 🎨 ✨\nNew line here.`;
    const composed = await composeRevisionPrompt({
      candidateId: "design-001",
      currentJsx: validJsx,
      revisionPrompt: specialPrompt,
      styleId: "swiss",
      parentVersionId: "v001",
    });

    expect(composed.userPrompt).toContain(specialPrompt);
    expect(composed.effectivePrompt).toContain(specialPrompt);
  });
});
