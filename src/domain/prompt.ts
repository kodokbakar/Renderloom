import type { AspectRatioPreset, ResolvedDimensions } from "./dimensions";

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
}
