export type CandidateState =
  | "queued"
  | "generating"
  | "validating"
  | "rendering"
  | "completed"
  | "failed"
  | "cancelled";

export interface CandidateTiming {
  queuedAt?: string;
  generationStartedAt?: string;
  generationEndedAt?: string;
  validationStartedAt?: string;
  validationEndedAt?: string;
  renderingStartedAt?: string;
  renderingEndedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface CandidateArtifacts {
  sourcePath?: string;
  svgPath?: string;
  pngPath?: string;
}

export interface Candidate {
  id: string;
  sessionId: string;
  index: number;
  state: CandidateState;
  label?: string;
  rationale?: string;
  currentVersionId?: string;
  errorMessage?: string;
  errorCode?: string;
  retries?: number;
  timings?: CandidateTiming;
  artifacts?: CandidateArtifacts;
  createdAt: string;
  updatedAt: string;
}
