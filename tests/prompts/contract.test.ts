import { describe, expect, test } from "bun:test";
import { ValidationError } from "../../src/domain/errors";
import {
  buildOutputContractInstructions,
  parseCandidateResponse,
} from "../../src/prompts/contract";

describe("Candidate Output Contract & Parser", () => {
  const sampleCandidate = {
    candidateIndex: 1,
    label: "Bauhaus Primary Grid",
    rationale: "Uses asymmetrical red block and heavy black rules for balance",
    jsx: '<div style={{ width: 1024, height: 1024, display: "flex", backgroundColor: "#F5F5F0" }}><span style={{ color: "#D02020", fontSize: 48 }}>BAUHAUS</span></div>',
  };

  test("generates output instructions reflecting requested candidate count", () => {
    const single = buildOutputContractInstructions(1);
    expect(single).toContain("STRUCTURED OUTPUT CONTRACT");
    expect(single).toContain("Provide exactly 1 candidate object");

    const multi = buildOutputContractInstructions(3);
    expect(multi).toContain("Provide exactly 3 candidate objects");
  });

  test("parses pure raw JSON response", () => {
    const raw = JSON.stringify({
      candidates: [sampleCandidate],
    });

    const parsed = parseCandidateResponse(raw);
    expect(parsed.candidates.length).toBe(1);
    expect(parsed.candidates[0]?.label).toBe("Bauhaus Primary Grid");
    expect(parsed.candidates[0]?.rationale).toContain("asymmetrical");
    expect(parsed.candidates[0]?.jsx).toContain("<div");
  });

  test("parses markdown fenced json response (```json ... ```)", () => {
    const raw = `Here is your requested design:
\`\`\`json
{
  "candidates": [
    ${JSON.stringify(sampleCandidate)}
  ]
}
\`\`\`
I hope this matches your aesthetic!`;

    const parsed = parseCandidateResponse(raw);
    expect(parsed.candidates.length).toBe(1);
    expect(parsed.candidates[0]?.label).toBe(sampleCandidate.label);
  });

  test("parses markdown fenced response without language identifier (``` ... ```)", () => {
    const raw = `\`\`\`
{
  "candidates": [
    ${JSON.stringify(sampleCandidate)}
  ]
}
\`\`\``;

    const parsed = parseCandidateResponse(raw);
    expect(parsed.candidates.length).toBe(1);
  });

  test("parses JSON surrounded by conversational text without fences", () => {
    const raw = `Design generated below:
{"candidates": [${JSON.stringify(sampleCandidate)}]}
Let me know if you need adjustments.`;

    const parsed = parseCandidateResponse(raw);
    expect(parsed.candidates.length).toBe(1);
    expect(parsed.candidates[0]?.jsx).toBe(sampleCandidate.jsx);
  });

  test("parses multiple candidates in one payload", () => {
    const c2 = {
      candidateIndex: 2,
      label: "Swiss Helvetica Flush",
      rationale: "Clean column layout with crimson highlight",
      jsx: '<div style={{ width: 1024, height: 1024, display: "flex" }}>Swiss</div>',
    };

    const raw = JSON.stringify({
      candidates: [sampleCandidate, c2],
    });

    const parsed = parseCandidateResponse(raw);
    expect(parsed.candidates.length).toBe(2);
    expect(parsed.candidates[0]?.candidateIndex).toBe(1);
    expect(parsed.candidates[1]?.candidateIndex).toBe(2);
    expect(parsed.candidates[1]?.label).toBe("Swiss Helvetica Flush");
  });

  test("normalizes missing or NaN candidate indices", () => {
    const raw = JSON.stringify({
      candidates: [
        {
          label: "No Index",
          rationale: "Has no index",
          jsx: "<div>Sample</div>",
        },
      ],
    });

    const parsed = parseCandidateResponse(raw);
    expect(parsed.candidates[0]?.candidateIndex).toBe(1);
  });

  test("rejects malformed or unparseable JSON", () => {
    expect(() => parseCandidateResponse("Not a json at all")).toThrow(
      ValidationError,
    );
    expect(() => parseCandidateResponse("{ broken json")).toThrow(
      ValidationError,
    );
  });

  test("rejects payload missing candidates array", () => {
    expect(() =>
      parseCandidateResponse(JSON.stringify({ result: [] })),
    ).toThrow(ValidationError);
    expect(() =>
      parseCandidateResponse(JSON.stringify({ candidates: [] })),
    ).toThrow(ValidationError);
  });

  test("rejects candidates missing required fields", () => {
    const missingJsx = {
      candidates: [
        {
          label: "Missing JSX",
          rationale: "No jsx included",
        },
      ],
    };
    expect(() => parseCandidateResponse(JSON.stringify(missingJsx))).toThrow(
      ValidationError,
    );

    const missingLabel = {
      candidates: [
        {
          rationale: "No label included",
          jsx: "<div>test</div>",
        },
      ],
    };
    expect(() => parseCandidateResponse(JSON.stringify(missingLabel))).toThrow(
      ValidationError,
    );

    const missingRationale = {
      candidates: [
        {
          label: "No Rationale",
          jsx: "<div>test</div>",
        },
      ],
    };
    expect(() =>
      parseCandidateResponse(JSON.stringify(missingRationale)),
    ).toThrow(ValidationError);
  });

  test("rejects candidate with non-JSX markup string", () => {
    const invalidJsx = {
      candidates: [
        {
          label: "Invalid JSX",
          rationale: "Plain text instead of tag",
          jsx: "Hello world without tags",
        },
      ],
    };
    expect(() => parseCandidateResponse(JSON.stringify(invalidJsx))).toThrow(
      ValidationError,
    );
  });
});
