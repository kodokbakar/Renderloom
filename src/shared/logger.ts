import { redactSecrets } from "../security/redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  eventType?: string;
  jobId?: string;
  candidateId?: string;
  stage?: string;
  errorCode?: string;
  data?: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  eventType?: string;
  jobId?: string;
  candidateId?: string;
  stage?: string;
  errorCode?: string;
  message: string;
  data?: unknown;
}

export type LogSink = (entry: LogEntry, rawJson: string) => void;

const SENSITIVE_KEYS: Record<string, true> = {
  authorization: true,
  auth: true,
  "x-api-key": true,
  x_api_key: true,
  apikey: true,
  api_key: true,
  token: true,
  secret: true,
  password: true,
  credential: true,
  credentials: true,
  cookie: true,
  "set-cookie": true,
  bearer: true,
};

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function sanitizeValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return redactSecrets(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSecrets(value.message),
      code: "code" in value ? redactSecrets(String(value.code)) : undefined,
      stack: value.stack ? redactSecrets(value.stack) : undefined,
    };
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item, seen));
    }

    const cleanObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const lowerKey = k.toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (SENSITIVE_KEYS[lowerKey]) {
        cleanObj[k] = "[REDACTED]";
      } else {
        cleanObj[k] = sanitizeValue(v, seen);
      }
    }
    return cleanObj;
  }

  return String(value);
}

export class Logger {
  private sink: LogSink | null = null;
  private minLevel: LogLevel = "debug";

  constructor(options?: { minLevel?: LogLevel; sink?: LogSink | null }) {
    if (options?.minLevel) {
      this.minLevel = options.minLevel;
    }
    if (options?.sink !== undefined) {
      this.sink = options.sink;
    }
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  getLevel(): LogLevel {
    return this.minLevel;
  }

  setSink(sink: LogSink | null): void {
    this.sink = sink;
  }

  getSink(): LogSink | null {
    return this.sink;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[this.minLevel];
  }

  log(level: LogLevel, message: string, context?: LogContext): LogEntry | null {
    if (!this.shouldLog(level)) {
      return null;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: redactSecrets(message),
    };

    if (context?.eventType) entry.eventType = context.eventType;
    if (context?.jobId) entry.jobId = context.jobId;
    if (context?.candidateId) entry.candidateId = context.candidateId;
    if (context?.stage) entry.stage = context.stage;
    if (context?.errorCode) entry.errorCode = redactSecrets(context.errorCode);
    if (context?.data !== undefined) {
      entry.data = sanitizeValue(context.data);
    }

    const json = JSON.stringify(entry);

    if (this.sink) {
      this.sink(entry, json);
    } else {
      if (level === "error") {
        console.error(json);
      } else if (level === "warn") {
        console.warn(json);
      } else {
        console.log(json);
      }
    }

    return entry;
  }

  info(message: string, context?: LogContext): LogEntry | null {
    return this.log("info", message, context);
  }

  warn(message: string, context?: LogContext): LogEntry | null {
    return this.log("warn", message, context);
  }

  error(message: string, context?: LogContext): LogEntry | null {
    return this.log("error", message, context);
  }

  debug(message: string, context?: LogContext): LogEntry | null {
    return this.log("debug", message, context);
  }
}

export const logger = new Logger();

export function setLogSink(sink: LogSink | null): void {
  logger.setSink(sink);
}

export function setLogLevel(level: LogLevel): void {
  logger.setLevel(level);
}
