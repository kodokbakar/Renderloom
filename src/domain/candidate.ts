export type CandidateState =
  | "queued"
  | "generating"
  | "validating"
  | "rendering"
  | "completed"
  | "failed"
  | "cancelled";

export interface Candidate {
  id: string;
  sessionId: string;
  index: number;
  state: CandidateState;
  currentVersionId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
