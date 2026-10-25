import { ValidationError } from "../domain/errors";
import type {
  CandidateOutputContract,
  GenerationOutputEnvelope,
  StorySlideDefinition,
} from "../domain/prompt";

export function buildOutputContractInstructions(
  candidateCount = 1,
  storySlide?: StorySlideDefinition,
): string {
  const count = Math.max(1, candidateCount);
  const narrativeInstruction = storySlide
    ? `2. This candidate represents Slide ${storySlide.index} of ${storySlide.totalSlides} (${storySlide.roleName} phase). In 'label' and 'rationale', explicitly reference the narrative role (${storySlide.role}) and explain how the visual layout serves this narrative arc phase.`
    : "2. Each candidate must represent a distinct visual exploration within the requested style.";

  return `### STRUCTURED OUTPUT CONTRACT
You must output a strictly valid JSON object adhering to the following schema.
Do NOT include explanations, markdown formatting, greetings, or conversational remarks outside the JSON block.

Required JSON Structure:
{
  "candidates": [
    {
      "candidateIndex": 1,
      "label": "Short descriptive design title (e.g., Asymmetric Modernist Grid)",
      "rationale": "1-2 sentences explaining visual hierarchy, typography, and palette choices.",
      "jsx": "<div style={{ width: 1024, height: 1024, display: 'flex', ... }}>...</div>"
    }
  ]
}

Instructions:
1. Provide exactly ${count} candidate object${count > 1 ? "s" : ""} in the 'candidates' array with candidateIndex numbered from 1 to ${count}.
${narrativeInstruction}
3. The 'jsx' property must be a single, complete, self-contained JSX string starting with a root <div> element.
4. Escape quotes properly inside the JSON string values.`;
}

function extractJsonString(rawText: string): string {
  const trimmed = rawText.trim();

  // Try direct parse first
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  // Check for markdown code fences (```json ... ``` or ``` ...)
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  // Look for the outermost JSON object brackets { ... }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export function parseCandidateResponse(
  rawText: string,
  expectedCount?: number,
): GenerationOutputEnvelope {
  if (!rawText || typeof rawText !== "string") {
    throw new ValidationError(
      "Cannot parse candidate response: empty or non-string input",
    );
  }

  const jsonString = extractJsonString(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new ValidationError(
      `Failed to parse candidate JSON response: ${(err as Error).message}`,
      { rawSnippet: rawText.slice(0, 200) },
    );
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("candidates" in parsed) ||
    !Array.isArray(parsed.candidates)
  ) {
    throw new ValidationError(
      "Invalid generation response: root object must contain a 'candidates' array",
      parsed,
    );
  }

  const rawCandidates = parsed.candidates;
  if (rawCandidates.length === 0) {
    throw new ValidationError(
      "Invalid generation response: 'candidates' array cannot be empty",
    );
  }

  const candidates: CandidateOutputContract[] = [];

  for (let i = 0; i < rawCandidates.length; i++) {
    const item = rawCandidates[i];
    if (!item || typeof item !== "object") {
      throw new ValidationError(
        `Candidate at index ${i} is not a valid object`,
      );
    }

    if (
      !("label" in item) ||
      typeof item.label !== "string" ||
      item.label.trim() === ""
    ) {
      throw new ValidationError(
        `Candidate at index ${i} is missing a required non-empty 'label' string`,
      );
    }

    if (
      !("rationale" in item) ||
      typeof item.rationale !== "string" ||
      item.rationale.trim() === ""
    ) {
      throw new ValidationError(
        `Candidate at index ${i} is missing a required non-empty 'rationale' string`,
      );
    }

    if (
      !("jsx" in item) ||
      typeof item.jsx !== "string" ||
      item.jsx.trim() === ""
    ) {
      throw new ValidationError(
        `Candidate at index ${i} is missing a required non-empty 'jsx' string`,
      );
    }

    const trimmedJsx = item.jsx.trim();
    if (!trimmedJsx.startsWith("<div") && !trimmedJsx.startsWith("<")) {
      throw new ValidationError(
        `Candidate at index ${i} contains invalid JSX markup (must start with opening tag)`,
      );
    }

    const candidateIndex =
      "candidateIndex" in item &&
      typeof item.candidateIndex === "number" &&
      !Number.isNaN(item.candidateIndex)
        ? item.candidateIndex
        : i + 1;

    candidates.push({
      candidateIndex,
      label: item.label.trim(),
      rationale: item.rationale.trim(),
      jsx: trimmedJsx,
    });
  }

  if (expectedCount !== undefined && candidates.length < expectedCount) {
    // Retain candidates for partial processing
  }

  return { candidates };
}
