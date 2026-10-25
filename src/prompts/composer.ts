import {
  MAX_CANDIDATE_COUNT,
  MAX_PROMPT_LENGTH,
  MIN_CANDIDATE_COUNT,
} from "../domain/dimensions";
import { ValidationError } from "../domain/errors";
import {
  type ComposePromptOptions,
  type ComposedPrompt,
  type StorySlideDefinition,
  getStorySlideDefinition,
} from "../domain/prompt";
import { resolveDimensions } from "../styles/dimensions";
import { StyleRegistry } from "../styles/registry";
import { buildOutputContractInstructions } from "./contract";
import { loadBasePrompt } from "./loader";
import { buildTechnicalConstraints } from "./technical-constraints";

export interface PromptComposerDependencies {
  styleRegistry?: StyleRegistry;
}

export function buildStoryModeInstructions(
  slide: StorySlideDefinition,
): string {
  const directives =
    slide.role === "hook"
      ? "- Lead with high visual tension, captivating focal point, or a provocative statement.\n- Draw the viewer in immediately with clear thematic presence.\n- Establish typography and style foundation for the sequence."
      : slide.role === "core"
        ? `- Present detailed concepts, structured sections, data points, or transformation steps.\n- Deepen the visual narrative as part of the body (slide ${slide.index} of ${slide.totalSlides}).\n- Maintain visual coherence with the opening slide while advancing the message.`
        : "- Provide resolution, impactful payoff, climax, or a definitive call to action.\n- Deliver the conclusion of the story sequence with maximum memorability.\n- Balance finality with emotional resonance.";

  return `### STORY MODE: NARRATIVE ARC INSTRUCTIONS
This composition is Slide ${slide.index} of ${slide.totalSlides} in a narrative visual sequence.
Narrative Arc Phase: ${slide.roleName.toUpperCase()} (${slide.role})

Narrative Objective:
${slide.narrativeGoal}

Design Directives for ${slide.roleName}:
${directives}

Visual Cohesion:
- All slides in this sequence share the requested style preset, color harmony, and typographic rules.
- Maintain seamless design language continuity across the narrative arc.`;
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

  const storyMode = Boolean(options.storyMode);
  const storySlide = storyMode
    ? (options.storySlide ?? getStorySlideDefinition(1, candidateCount))
    : undefined;

  const technicalConstraints = buildTechnicalConstraints(dimensions);
  const outputContract = buildOutputContractInstructions(
    candidateCount,
    storySlide,
  );

  const systemSections = [basePrompt, technicalConstraints, styleInstructions];

  if (storySlide) {
    systemSections.push(buildStoryModeInstructions(storySlide));
  }

  systemSections.push(outputContract);
  const systemPrompt = systemSections.join("\n\n---\n\n");

  let userPrompt = `### USER DESIGN REQUEST
Target Dimensions: ${dimensions.width}px x ${dimensions.height}px (${dimensions.aspectRatio})
Requested Style: ${stylePreset.name} (${stylePreset.id})
Candidate Count: ${candidateCount}`;

  if (storySlide) {
    userPrompt += `\nStory Mode: Active (${storySlide.roleName} - Slide ${storySlide.index}/${storySlide.totalSlides})`;
    userPrompt += `\nSlide Narrative Role: ${storySlide.roleName} (${storySlide.role})`;
    userPrompt += `\nNarrative Goal: ${storySlide.narrativeGoal}`;
  }

  userPrompt += `\n\nUser Instructions:\n${trimmedPrompt}`;

  const effectivePrompt = `${systemPrompt}\n\n===\n\n${userPrompt}`;

  return {
    systemPrompt,
    userPrompt,
    effectivePrompt,
    metadata: {
      styleId: options.styleId,
      candidateCount,
      dimensions,
      storyMode,
      storySlide,
    },
  };
}
