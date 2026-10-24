import type { Candidate } from "../domain/candidate";

export type BatchStatus =
  | "queued"
  | "running"
  | "completed"
  | "partial_success"
  | "failed"
  | "cancelled";

export interface StartGenerationOptions {
  sessionId: string;
  prompt: string;
  styleId?: string;
  candidateCount?: number;
  providerId?: string;
  modelId?: string;
  apiKey?: string;
  baseUrl?: string;
  width?: number;
  height?: number;
  concurrency?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

export interface CandidateJobRecord {
  candidateId: string;
  index: number;
  candidate: Candidate;
  abortController: AbortController;
  promise?: Promise<Candidate>;
}

export interface GenerationBatch {
  id: string;
  sessionId: string;
  status: BatchStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  options: StartGenerationOptions;
  candidates: CandidateJobRecord[];
  abortController: AbortController;
  completionPromise: Promise<GenerationBatch>;
}

export interface BatchView {
  id: string;
  sessionId: string;
  status: BatchStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  candidates: Candidate[];
  summary?: {
    total: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
}
