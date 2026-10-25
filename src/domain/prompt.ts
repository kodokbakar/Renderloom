import type { AspectRatioPreset, ResolvedDimensions } from "./dimensions";

export type StoryArcRole = "hook" | "core" | "payoff";

export interface StorySlideDefinition {
  index: number;
  totalSlides: number;
  role: StoryArcRole;
  roleName: "Hook" | "Core" | "Payoff";
  narrativeGoal: string;
}

export function getStorySlideDefinition(
  index: number,
  totalSlides: number,
): StorySlideDefinition {
  const total = Math.max(1, totalSlides);
  const slideIndex = Math.max(1, Math.min(index, total));

  let role: StoryArcRole;
  let roleName: "Hook" | "Core" | "Payoff";
  let narrativeGoal: string;

  if (total === 1) {
    role = "hook";
    roleName = "Hook";
    narrativeGoal =
      "Capture immediate visual interest, establish the primary subject, and state the central core message in a single focused composition.";
  } else if (slideIndex === 1) {
    role = "hook";
    roleName = "Hook";
    narrativeGoal =
      "Capture immediate attention with a striking opening visual, establish curiosity, and present the primary problem, question, or bold proposition.";
  } else if (slideIndex === total) {
    role = "payoff";
    roleName = "Payoff";
    narrativeGoal =
      "Deliver the definitive narrative payoff, climax, resolution, key takeaway, or compelling call to action.";
  } else {
    role = "core";
    roleName = "Core";
    narrativeGoal = `Develop the core narrative (slide ${slideIndex} of ${total}), elaborating with evidence, supportive concepts, transformation, or structural depth.`;
  }

  return {
    index: slideIndex,
    totalSlides: total,
    role,
    roleName,
    narrativeGoal,
  };
}

export interface CandidateOutputContract {
  candidateIndex: number;
  label: string;
  rationale: string;
  jsx: string;
}

export interface GenerationOutputEnvelope {
  candidates: CandidateOutputContract[];
}

export interface ComposedPromptMetadata {
  styleId: string;
  candidateCount: number;
  dimensions: ResolvedDimensions;
  storyMode?: boolean;
  storySlide?: StorySlideDefinition;
}

export interface ComposedPrompt {
  systemPrompt: string;
  userPrompt: string;
  effectivePrompt: string;
  metadata: ComposedPromptMetadata;
}

export interface ComposePromptOptions {
  prompt: string;
  styleId: string;
  candidateCount?: number;
  aspectRatio?: AspectRatioPreset;
  width?: number;
  height?: number;
  customBasePromptPath?: string;
  basePromptOverride?: string;
  storyMode?: boolean;
  storySlide?: StorySlideDefinition;
}
