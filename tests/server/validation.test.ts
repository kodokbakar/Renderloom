import { describe, expect, test } from "bun:test";
import {
  validateComposePromptRequest,
  validateCreateSessionRequest,
  validateGenerationRequest,
} from "../../src/server/validation";

describe("API Request Validation", () => {
  const baseGenRequest = {
    sessionId: "session-1",
    prompt: "A poster",
    styleId: "bauhaus",
    width: 1080,
    height: 1080,
    outputFormat: "png",
    providerId: "anthropic",
    modelId: "claude-3-7-sonnet",
  };

  test("accepts valid generation request", () => {
    const valid = {
      ...baseGenRequest,
      candidateCount: 2,
    };
    const res = validateGenerationRequest(valid);
    expect(res.sessionId).toBe("session-1");
  });

  test("validateGenerationRequest accepts boundary candidate counts (1 and 10)", () => {
    const req1 = validateGenerationRequest({
      ...baseGenRequest,
      candidateCount: 1,
    });
    expect(req1.candidateCount).toBe(1);

    const req10 = validateGenerationRequest({
      ...baseGenRequest,
      candidateCount: 10,
    });
    expect(req10.candidateCount).toBe(10);
  });

  test("validateGenerationRequest rejects out-of-boundary candidate counts (0, 11, negative)", () => {
    expect(() =>
      validateGenerationRequest({ ...baseGenRequest, candidateCount: 0 }),
    ).toThrow();
    expect(() =>
      validateGenerationRequest({ ...baseGenRequest, candidateCount: 11 }),
    ).toThrow();
    expect(() =>
      validateGenerationRequest({ ...baseGenRequest, candidateCount: -1 }),
    ).toThrow();
  });

  test("validateGenerationRequest rejects non-integer candidate counts", () => {
    expect(() =>
      validateGenerationRequest({ ...baseGenRequest, candidateCount: 2.5 }),
    ).toThrow();
    expect(() =>
      validateGenerationRequest({ ...baseGenRequest, candidateCount: 7.9 }),
    ).toThrow();
  });

  test("validateGenerationRequest rejects non-numeric or missing candidate counts", () => {
    expect(() =>
      validateGenerationRequest({ ...baseGenRequest, candidateCount: "3" }),
    ).toThrow();
    expect(() =>
      validateGenerationRequest({ ...baseGenRequest, candidateCount: null }),
    ).toThrow();
    expect(() =>
      validateGenerationRequest({
        ...baseGenRequest,
        candidateCount: Number.NaN,
      }),
    ).toThrow();
    expect(() =>
      validateGenerationRequest({
        ...baseGenRequest,
        candidateCount: undefined,
      }),
    ).toThrow();
  });

  test("validateGenerationRequest accepts storyMode boolean or omitted", () => {
    const resTrue = validateGenerationRequest({
      ...baseGenRequest,
      candidateCount: 3,
      storyMode: true,
    });
    expect(resTrue.storyMode).toBe(true);

    const resFalse = validateGenerationRequest({
      ...baseGenRequest,
      candidateCount: 3,
      storyMode: false,
    });
    expect(resFalse.storyMode).toBe(false);

    const resOmitted = validateGenerationRequest({
      ...baseGenRequest,
      candidateCount: 3,
    });
    expect(resOmitted.storyMode).toBeUndefined();
  });

  test("validateGenerationRequest rejects non-boolean storyMode", () => {
    expect(() =>
      validateGenerationRequest({
        ...baseGenRequest,
        candidateCount: 3,
        storyMode: "true",
      }),
    ).toThrow();
    expect(() =>
      validateGenerationRequest({
        ...baseGenRequest,
        candidateCount: 3,
        storyMode: 1,
      }),
    ).toThrow();
    expect(() =>
      validateGenerationRequest({
        ...baseGenRequest,
        candidateCount: 3,
        storyMode: null,
      }),
    ).toThrow();
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

  test("validateCreateSessionRequest validates storyMode boolean or rejects invalid", () => {
    const validWithStory = validateCreateSessionRequest({
      name: "Story Project",
      providerId: "anthropic",
      modelId: "claude-3-7-sonnet",
      styleId: "bauhaus",
      width: 1080,
      height: 1080,
      storyMode: true,
    });
    expect(validWithStory.storyMode).toBe(true);

    expect(() =>
      validateCreateSessionRequest({
        name: "Story Project",
        providerId: "anthropic",
        modelId: "claude-3-7-sonnet",
        styleId: "bauhaus",
        width: 1080,
        height: 1080,
        storyMode: "yes",
      }),
    ).toThrow();
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

  test("validateComposePromptRequest validates candidateCount boundaries (1-10) and storyMode", () => {
    const validMin = validateComposePromptRequest({
      prompt: "Compose request",
      styleId: "bauhaus",
      candidateCount: 1,
      storyMode: true,
    });
    expect(validMin.candidateCount).toBe(1);
    expect(validMin.storyMode).toBe(true);

    const validMax = validateComposePromptRequest({
      prompt: "Compose request",
      styleId: "bauhaus",
      candidateCount: 10,
      storyMode: false,
    });
    expect(validMax.candidateCount).toBe(10);
    expect(validMax.storyMode).toBe(false);

    expect(() =>
      validateComposePromptRequest({
        prompt: "Compose request",
        styleId: "bauhaus",
        candidateCount: 0,
      }),
    ).toThrow();

    expect(() =>
      validateComposePromptRequest({
        prompt: "Compose request",
        styleId: "bauhaus",
        candidateCount: 11,
      }),
    ).toThrow();

    expect(() =>
      validateComposePromptRequest({
        prompt: "Compose request",
        styleId: "bauhaus",
        candidateCount: 4.5,
      }),
    ).toThrow();

    expect(() =>
      validateComposePromptRequest({
        prompt: "Compose request",
        styleId: "bauhaus",
        storyMode: "active",
      }),
    ).toThrow();
  });
});
