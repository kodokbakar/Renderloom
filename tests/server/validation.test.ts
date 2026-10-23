import { describe, expect, test } from "bun:test";
import {
  validateCreateSessionRequest,
  validateGenerationRequest,
} from "../../src/server/validation";

describe("API Request Validation", () => {
  test("accepts valid generation request", () => {
    const valid = {
      sessionId: "session-1",
      prompt: "A poster",
      styleId: "bauhaus",
      candidateCount: 2,
      width: 1080,
      height: 1080,
      outputFormat: "png",
      providerId: "anthropic",
      modelId: "claude-3-7-sonnet",
    };
    const res = validateGenerationRequest(valid);
    expect(res.sessionId).toBe("session-1");
  });

  test("rejects invalid dimensions or candidate counts", () => {
    const invalid = {
      sessionId: "session-1",
      prompt: "A poster",
      styleId: "bauhaus",
      candidateCount: 0, // must be >= 1
      width: -100, // must be > 0
      height: 1080,
      outputFormat: "png",
      providerId: "anthropic",
      modelId: "claude-3-7-sonnet",
    };
    expect(() => validateGenerationRequest(invalid)).toThrow();
  });

  test("rejects unsupported output formats", () => {
    const invalid = {
      sessionId: "session-1",
      prompt: "A poster",
      styleId: "bauhaus",
      candidateCount: 1,
      width: 800,
      height: 600,
      outputFormat: "jpg",
      providerId: "anthropic",
      modelId: "claude-3-7-sonnet",
    };
    expect(() => validateGenerationRequest(invalid)).toThrow();
  });

  test("accepts valid create session request", () => {
    const valid = {
      name: "Poster Project",
      providerId: "anthropic",
      modelId: "claude-3-7-sonnet",
      styleId: "bauhaus",
      width: 1080,
      height: 1080,
    };
    const res = validateCreateSessionRequest(valid);
    expect(res.name).toBe("Poster Project");
  });

  test("rejects invalid create session request", () => {
    const invalid = {
      name: "",
      providerId: "anthropic",
      modelId: "claude-3-7-sonnet",
      styleId: "bauhaus",
      width: 10, // must be >= 64
      height: 1080,
    };
    expect(() => validateCreateSessionRequest(invalid)).toThrow();
  });
});
