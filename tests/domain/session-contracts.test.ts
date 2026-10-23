import { describe, expect, test } from "bun:test";
import {
  type Conversation,
  type FullSession,
  type GenerationConfig,
  SESSION_SCHEMA_VERSION,
  type Session,
  SessionError,
  type SessionSummary,
} from "../../src/domain";

describe("Session Domain Contracts", () => {
  test("SESSION_SCHEMA_VERSION is defined as 1", () => {
    expect(SESSION_SCHEMA_VERSION).toBe(1);
  });

  test("Session and SessionSummary structures align", () => {
    const session: Session = {
      schemaVersion: SESSION_SCHEMA_VERSION,
      id: "sess-123",
      name: "Test Session",
      slug: "test-session",
      createdAt: "2026-10-23T00:00:00.000Z",
      updatedAt: "2026-10-23T00:00:00.000Z",
      providerId: "openai",
      modelId: "gpt-4o",
      styleId: "bauhaus",
      dimensions: { width: 1024, height: 1024 },
    };

    const summary: SessionSummary = {
      id: session.id,
      name: session.name,
      slug: session.slug,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      providerId: session.providerId,
      modelId: session.modelId,
      styleId: session.styleId,
      dimensions: session.dimensions,
      candidateCount: 4,
    };

    expect(summary.slug).toBe("test-session");
    expect(summary.candidateCount).toBe(4);
  });

  test("FullSession holds all required metadata components", () => {
    const session: Session = {
      id: "sess-1",
      name: "Poster",
      slug: "poster",
      createdAt: "2026-10-23T00:00:00.000Z",
      updatedAt: "2026-10-23T00:00:00.000Z",
      providerId: "openai",
      modelId: "gpt-4o",
      styleId: "minimal",
      dimensions: { width: 800, height: 600 },
    };

    const conversation: Conversation = {
      sessionId: "sess-1",
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "Create a minimal Swiss poster",
          timestamp: "2026-10-23T00:00:00.000Z",
        },
      ],
      updatedAt: "2026-10-23T00:00:00.000Z",
    };

    const generationConfig: GenerationConfig = {
      providerId: "openai",
      modelId: "gpt-4o",
      styleId: "minimal",
      candidateCount: 2,
      width: 800,
      height: 600,
      outputFormat: "png",
      createdAt: "2026-10-23T00:00:00.000Z",
    };

    const fullSession: FullSession = {
      session,
      conversation,
      promptSnapshot: "Prompt snapshot text",
      generationConfig,
      artifacts: {
        images: ["design-001-v001.png"],
        source: ["design-001-v001.jsx"],
        svg: ["design-001-v001.svg"],
        assets: [],
      },
    };

    expect(fullSession.artifacts.images.length).toBe(1);
    expect(fullSession.conversation.messages[0]?.role).toBe("user");
  });

  test("SessionError instantiates with correct error codes", () => {
    const err = new SessionError(
      "SESSION_NOT_FOUND",
      "Session sess-404 not found",
      { id: "sess-404" },
    );
    expect(err.name).toBe("SessionError");
    expect(err.code).toBe("SESSION_NOT_FOUND");
    expect(err.message).toBe("Session sess-404 not found");
    expect(err.details).toEqual({ id: "sess-404" });
  });
});
