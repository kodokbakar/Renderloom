import { MAX_RESPONSE_SIZE, MAX_SOURCE_LENGTH } from "../domain/dimensions";
import { ValidationError } from "../domain/errors";
import type { CandidateOutputContract } from "../domain/prompt";

export interface ParserOptions {
  maxResponseSize?: number;
  maxSourceLength?: number;
  expectedIndex?: number;
}

function extractJsonString(rawText: string): string {
  const trimmed = rawText.trim();

  // Direct JSON
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  // Markdown code fences
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  // Outermost JSON brackets
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function validateAndSanitizeCandidate(
  item: unknown,
  maxSourceLength: number,
  fallbackIndex = 1,
): CandidateOutputContract {
  if (!item || typeof item !== "object") {
    throw new ValidationError("Candidate payload is not a valid object");
  }

  const obj = item as Record<string, unknown>;

  // Check for ambiguous keys
  const ambiguousKeys = ["code", "component", "html", "markup", "source"];
  for (const key of ambiguousKeys) {
    if (key in obj && !("jsx" in obj)) {
      throw new ValidationError(
        `Ambiguous source field found: expected 'jsx', found '${key}'`,
      );
    }
  }

  if (!("label" in obj) || typeof obj.label !== "string" || !obj.label.trim()) {
    throw new ValidationError(
      "Candidate is missing a required non-empty 'label' string",
    );
  }

  if (
    !("rationale" in obj) ||
    typeof obj.rationale !== "string" ||
    !obj.rationale.trim()
  ) {
    throw new ValidationError(
      "Candidate is missing a required non-empty 'rationale' string",
    );
  }

  if (!("jsx" in obj) || typeof obj.jsx !== "string" || !obj.jsx.trim()) {
    throw new ValidationError(
      "Candidate is missing a required non-empty 'jsx' string",
    );
  }

  const jsx = obj.jsx.trim();
  if (jsx.length > maxSourceLength) {
    throw new ValidationError(
      `Candidate source length (${jsx.length} bytes) exceeds maximum allowed of ${maxSourceLength} bytes`,
    );
  }

  if (!jsx.startsWith("<")) {
    throw new ValidationError(
      "Candidate 'jsx' markup must start with a JSX opening tag (e.g. '<div')",
    );
  }

  const candidateIndex =
    typeof obj.candidateIndex === "number" && !Number.isNaN(obj.candidateIndex)
      ? obj.candidateIndex
      : fallbackIndex;

  return {
    candidateIndex,
    label: obj.label.trim(),
    rationale: obj.rationale.trim(),
    jsx,
  };
}

export function normalizeCandidateResponse(
  rawText: string,
  options: ParserOptions = {},
): CandidateOutputContract {
  if (!rawText || typeof rawText !== "string") {
    throw new ValidationError("Model response is empty or not a string");
  }

  const maxResponseSize = options.maxResponseSize ?? MAX_RESPONSE_SIZE;
  const maxSourceLength = options.maxSourceLength ?? MAX_SOURCE_LENGTH;

  if (rawText.length > maxResponseSize) {
    throw new ValidationError(
      `Response size (${rawText.length} bytes) exceeds maximum allowed of ${maxResponseSize} bytes`,
    );
  }

  const jsonString = extractJsonString(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new ValidationError(
      `Failed to parse model response as JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new ValidationError(
      "Parsed model response is not a valid JSON object",
    );
  }

  // Case 1: envelope with candidates array: { candidates: [...] }
  if (
    "candidates" in parsed &&
    Array.isArray((parsed as Record<string, unknown>).candidates)
  ) {
    const list = (parsed as Record<string, unknown>).candidates as unknown[];
    if (list.length === 0) {
      throw new ValidationError(
        "Model response envelope contains empty candidates array",
      );
    }

    const targetIdx =
      options.expectedIndex !== undefined ? options.expectedIndex - 1 : 0;
    const selected = list[targetIdx] ?? list[0];
    return validateAndSanitizeCandidate(
      selected,
      maxSourceLength,
      options.expectedIndex ?? 1,
    );
  }

  // Case 2: direct single candidate object: { label, rationale, jsx }
  return validateAndSanitizeCandidate(
    parsed,
    maxSourceLength,
    options.expectedIndex ?? 1,
  );
}
