import { describe, expect, test } from "bun:test";
import {
  MAX_RESPONSE_SIZE,
  MAX_SOURCE_LENGTH,
} from "../../src/domain/dimensions";
import { ValidationError } from "../../src/domain/errors";
import { normalizeCandidateResponse } from "../../src/jobs/parser";

describe("Candidate response parser and size enforcer", () => {
  const validSingle = JSON.stringify({
    label: "Modern Card",
    rationale: "Clean minimalist layout",
    jsx: "<div style={{ display: 'flex', color: 'red' }}>Hello</div>",
  });

  test("parses valid direct single candidate JSON", () => {
    const res = normalizeCandidateResponse(validSingle);
    expect(res.label).toBe("Modern Card");
    expect(res.rationale).toBe("Clean minimalist layout");
    expect(res.jsx).toBe(
      "<div style={{ display: 'flex', color: 'red' }}>Hello</div>",
    );
    expect(res.candidateIndex).toBe(1);
  });

  test("parses markdown code-fenced JSON", () => {
    const fenced = `Here is your candidate:\n\`\`\`json\n${validSingle}\n\`\`\`\nHope you like it!`;
    const res = normalizeCandidateResponse(fenced);
    expect(res.label).toBe("Modern Card");
  });

  test("parses envelope candidate array", () => {
    const envelope = JSON.stringify({
      candidates: [
        {
          label: "Candidate 1",
          rationale: "Rationale 1",
          jsx: "<div style={{ padding: 10 }}>First</div>",
        },
        {
          label: "Candidate 2",
          rationale: "Rationale 2",
          jsx: "<div style={{ padding: 20 }}>Second</div>",
        },
      ],
    });

    const res1 = normalizeCandidateResponse(envelope, { expectedIndex: 1 });
    expect(res1.label).toBe("Candidate 1");

    const res2 = normalizeCandidateResponse(envelope, { expectedIndex: 2 });
    expect(res2.label).toBe("Candidate 2");
  });

  test("enforces response size limit before parsing", () => {
    // Construct oversized raw text (> 1MB)
    const padding = "x".repeat(MAX_RESPONSE_SIZE + 10);
    expect(() => normalizeCandidateResponse(padding)).toThrow(ValidationError);
    expect(() => normalizeCandidateResponse(padding)).toThrow(
      /exceeds maximum allowed of 1048576 bytes/,
    );
  });

  test("enforces source length limit on JSX", () => {
    const hugeJsx = `<div style={{ color: 'blue' }}>${"a".repeat(MAX_SOURCE_LENGTH + 10)}</div>`;
    const payload = JSON.stringify({
      label: "Huge",
      rationale: "Oversized source",
      jsx: hugeJsx,
    });

    expect(() => normalizeCandidateResponse(payload)).toThrow(ValidationError);
    expect(() => normalizeCandidateResponse(payload)).toThrow(
      /exceeds maximum allowed of 131072 bytes/,
    );
  });

  test("rejects ambiguous keys in candidate payload", () => {
    const withCode = JSON.stringify({
      label: "Test",
      rationale: "Test",
      code: "<div>hello</div>",
    });
    expect(() => normalizeCandidateResponse(withCode)).toThrow(
      "Ambiguous source field found: expected 'jsx', found 'code'",
    );

    const withHtml = JSON.stringify({
      label: "Test",
      rationale: "Test",
      html: "<div>hello</div>",
    });
    expect(() => normalizeCandidateResponse(withHtml)).toThrow(
      "Ambiguous source field found: expected 'jsx', found 'html'",
    );
  });

  test("rejects missing required fields", () => {
    expect(() =>
      normalizeCandidateResponse(
        JSON.stringify({ rationale: "r", jsx: "<div></div>" }),
      ),
    ).toThrow(/missing a required non-empty 'label'/);

    expect(() =>
      normalizeCandidateResponse(
        JSON.stringify({ label: "l", jsx: "<div></div>" }),
      ),
    ).toThrow(/missing a required non-empty 'rationale'/);

    expect(() =>
      normalizeCandidateResponse(
        JSON.stringify({ label: "l", rationale: "r" }),
      ),
    ).toThrow(/missing a required non-empty 'jsx'/);
  });

  test("rejects JSX not starting with opening tag", () => {
    const invalidJsx = JSON.stringify({
      label: "L",
      rationale: "R",
      jsx: "const Component = () => <div>hello</div>;",
    });

    expect(() => normalizeCandidateResponse(invalidJsx)).toThrow(
      "Candidate 'jsx' markup must start with a JSX opening tag",
    );
  });

  test("rejects invalid JSON syntax", () => {
    expect(() => normalizeCandidateResponse("{ broken json")).toThrow(
      /Failed to parse model response as JSON/,
    );
  });
});
