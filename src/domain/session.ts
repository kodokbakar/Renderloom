import type { Candidate } from "./candidate";

export interface BatchSummary {
  batchId: string;
  status: "completed" | "partial_success" | "failed" | "cancelled";
  totalCandidates: number;
  successfulCandidates: number;
  failedCandidates: number;
  cancelledCandidates: number;
  completedAt: string;
}

export const SESSION_SCHEMA_VERSION = 1;

export interface Session {
  schemaVersion?: number;
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  providerId: string;
  modelId: string;
  styleId: string;
  dimensions: {
    width: number;
    height: number;
  };
  candidates?: Candidate[];
  activeBatchId?: string;
  lastBatchStatus?: string;
  lastBatchSummary?: BatchSummary;
}

export interface SessionSummary {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  providerId: string;
  modelId: string;
  styleId: string;
  dimensions: {
    width: number;
    height: number;
  };
  candidateCount?: number;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  candidateId?: string;
}

export interface Conversation {
  sessionId: string;
  messages: ConversationMessage[];
  updatedAt: string;
}

export interface GenerationConfig {
  providerId: string;
  modelId: string;
  styleId: string;
  styleVersion?: string;
  candidateCount: number;
  width: number;
  height: number;
  outputFormat: "png";
  createdAt: string;
}

export interface SessionArtifacts {
  images: string[];
  source: string[];
  svg: string[];
  assets: string[];
}

export interface FullSession {
  session: Session;
  conversation: Conversation;
  promptSnapshot: string;
  generationConfig: GenerationConfig;
  artifacts: SessionArtifacts;
}
