import type { AspectRatioPreset } from "./dimensions";

export interface GenerationRequest {
  sessionId: string;
  prompt: string;
  styleId: string;
  candidateCount: number;
  width: number;
  height: number;
  aspectRatio?: AspectRatioPreset;
  outputFormat: "png";
  providerId: string;
  modelId: string;
  storyMode?: boolean;
}

export interface CreateSessionRequest {
  name: string;
  providerId: string;
  modelId: string;
  styleId: string;
  width: number;
  height: number;
  aspectRatio?: AspectRatioPreset;
  initialPrompt?: string;
  storyMode?: boolean;
}

export interface ResolveDimensionsRequest {
  aspectRatio?: AspectRatioPreset;
  width?: number;
  height?: number;
}

export interface ComposePromptRequest {
  prompt: string;
  styleId: string;
  candidateCount?: number;
  aspectRatio?: AspectRatioPreset;
  width?: number;
  height?: number;
  storyMode?: boolean;
}
