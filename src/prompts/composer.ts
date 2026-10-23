import {
  MAX_CANDIDATE_COUNT,
  MAX_PROMPT_LENGTH,
  MIN_CANDIDATE_COUNT,
} from "../domain/dimensions";
import { ValidationError } from "../domain/errors";
import type { ComposePromptOptions, ComposedPrompt } from "../domain/prompt";
import { resolveDimensions } from "../styles/dimensions";
import { StyleRegistry } from "../styles/registry";
import { buildOutputContractInstructions } from "./contract";
import { loadBasePrompt } from "./loader";
import { buildTechnicalConstraints } from "./technical-constraints";

export interface PromptComposerDependencies {
  styleRegistry?: StyleRegistry;
}

export async function composePrompt(
  options: ComposePromptOptions,
  dependencies: PromptComposerDependencies = {},
): Promise<ComposedPrompt> {
  if (!options || typeof options !== "object") {
    throw new ValidationError("composePrompt requires options object");
  }

  const trimmedPrompt = options.prompt?.trim();
  if (!trimmedPrompt) {
    throw new ValidationError("Prompt cannot be empty");
  }

  if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
    throw new ValidationError(
      `Prompt length (${trimmedPrompt.length}) exceeds maximum allowed of ${MAX_PROMPT_LENGTH} characters`,
    );
  }

  if (!options.styleId || typeof options.styleId !== "string") {
    throw new ValidationError("styleId is required");
  }

  const candidateCount = options.candidateCount ?? 1;
  if (
    !Number.isInteger(candidateCount) ||
    candidateCount < MIN_CANDIDATE_COUNT ||
    candidateCount > MAX_CANDIDATE_COUNT
  ) {
    throw new ValidationError(
      `candidateCount must be an integer between ${MIN_CANDIDATE_COUNT} and ${MAX_CANDIDATE_COUNT}`,
    );
  }

  const dimensions = resolveDimensions({
    aspectRatio: options.aspectRatio,
    width: options.width,
    height: options.height,
  });

  const registry = dependencies.styleRegistry ?? new StyleRegistry();
  const stylePreset = await registry.getPreset(options.styleId);
  const styleInstructions = await registry.formatStyleInstructions(
    options.styleId,
  );

  const basePrompt =
    options.basePromptOverride ??
    (await loadBasePrompt(options.customBasePromptPath));

  const technicalConstraints = buildTechnicalConstraints(dimensions);
  const outputContract = buildOutputContractInstructions(candidateCount);

  const systemPrompt = [
    basePrompt,
    technicalConstraints,
    styleInstructions,
    outputContract,
  ].join("\n\n---\n\n");

  const userPrompt = `### USER DESIGN REQUEST
Target Dimensions: ${dimensions.width}px x ${dimensions.height}px (${dimensions.aspectRatio})
Requested Style: ${stylePreset.name} (${stylePreset.id})
Candidate Count: ${candidateCount}

User Instructions:
${trimmedPrompt}`;

  const effectivePrompt = `${systemPrompt}\n\n===\n\n${userPrompt}`;

  return {
    systemPrompt,
    userPrompt,
    effectivePrompt,
    metadata: {
      styleId: options.styleId,
      candidateCount,
      dimensions,
    },
  };
}
