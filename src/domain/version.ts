export interface SafeModelMetadata {
  providerId: string;
  modelId: string;
  durationMs?: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface Version {
  id: string;
  candidateId: string;
  versionNumber: number;
  parentVersionId?: string;
  promptSnapshot: string;
  revisionPrompt?: string;
  modelMetadata?: SafeModelMetadata;
  label?: string;
  rationale?: string;
  jsxSourcePath: string;
  svgPath: string;
  pngPath: string;
  createdAt: string;
}
