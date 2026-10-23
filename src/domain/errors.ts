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

export type SessionErrorCode =
  | "SESSION_NOT_FOUND"
  | "SESSION_ALREADY_EXISTS"
  | "INVALID_PATH"
  | "INVALID_SESSION_NAME"
  | "CORRUPT_SESSION"
  | "ARTIFACT_NOT_FOUND"
  | "IMMUTABLE_ARTIFACT";

export class SessionError extends Error {
  constructor(
    public readonly code: SessionErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "SessionError";
  }
}

export type ProviderErrorCode =
  | "UNAUTHORIZED"
  | "INSUFFICIENT_QUOTA"
  | "RATE_LIMITED"
  | "MODEL_NOT_FOUND"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "INVALID_REQUEST"
  | "PROVIDER_ERROR";

export class ProviderError extends Error implements RenderloomError {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly providerId?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
