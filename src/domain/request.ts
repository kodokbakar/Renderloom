export interface GenerationRequest {
  sessionId: string;
  prompt: string;
  styleId: string;
  candidateCount: number;
  width: number;
  height: number;
  outputFormat: "png";
  providerId: string;
  modelId: string;
}

export interface CreateSessionRequest {
  name: string;
  providerId: string;
  modelId: string;
  styleId: string;
  width: number;
  height: number;
  initialPrompt?: string;
}
