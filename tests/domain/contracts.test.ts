import { describe, expect, test } from "bun:test";
import {
  type Candidate,
  type CandidateState,
  type GenerationRequest,
  type RenderloomError,
  type Session,
  ValidationError,
  type Version,
} from "../../src/domain";

describe("Domain Contracts", () => {
  test("candidate lifecycle states are valid", () => {
    const states: CandidateState[] = [
      "queued",
      "generating",
      "validating",
      "rendering",
      "completed",
      "failed",
      "cancelled",
    ];
    expect(states.length).toBe(7);
  });

  test("generation request type structure is sound", () => {
    const request: GenerationRequest = {
      sessionId: "sess-01",
      prompt: "minimalist poster",
      styleId: "bauhaus",
      candidateCount: 4,
      width: 1080,
      height: 1080,
      outputFormat: "png",
      providerId: "openai",
      modelId: "gpt-4o",
    };
    expect(request.candidateCount).toBe(4);
    expect(request.outputFormat).toBe("png");
  });

  test("ValidationError instantiates with code and details", () => {
    const err = new ValidationError("invalid prompt", { field: "prompt" });
    expect(err.name).toBe("ValidationError");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("invalid prompt");
    expect(err.details).toEqual({ field: "prompt" });
  });
});
