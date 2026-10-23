export interface RenderloomError {
  code: string;
  message: string;
  details?: unknown;
}

export class ValidationError extends Error {
  readonly code = "VALIDATION_ERROR";
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export type RenderErrorCode =
  | "UNSUPPORTED_SYNTAX"
  | "DANGEROUS_CODE_DETECTED"
  | "UNTRUSTED_REMOTE_ASSET"
  | "RENDER_FAILED";

export class RenderError extends Error {
  constructor(
    public readonly code: RenderErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "RenderError";
  }
}
