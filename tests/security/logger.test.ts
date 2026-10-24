import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  type LogEntry,
  type LogSink,
  Logger,
  logger,
  setLogLevel,
  setLogSink,
} from "../../src/shared/logger";

describe("Structured Logger", () => {
  let capturedEntries: LogEntry[] = [];
  let capturedRawJson: string[] = [];

  const testSink: LogSink = (entry, rawJson) => {
    capturedEntries.push(entry);
    capturedRawJson.push(rawJson);
  };

  beforeEach(() => {
    capturedEntries = [];
    capturedRawJson = [];
    setLogSink(testSink);
    setLogLevel("debug");
  });

  afterEach(() => {
    setLogSink(null);
    setLogLevel("debug");
  });

  test("emits single-line JSON log entries with timestamp and level", () => {
    logger.info("Session started", {
      eventType: "session_created",
      jobId: "job-123",
      candidateId: "cand-456",
      stage: "init",
    });

    expect(capturedEntries.length).toBe(1);
    expect(capturedRawJson.length).toBe(1);

    const entry = capturedEntries[0];
    const raw = capturedRawJson[0];
    expect(entry).toBeDefined();
    expect(raw).toBeDefined();
    if (!entry || !raw) throw new Error("Expected entry and raw json");

    expect(entry.level).toBe("info");
    expect(entry.message).toBe("Session started");
    expect(entry.eventType).toBe("session_created");
    expect(entry.jobId).toBe("job-123");
    expect(entry.candidateId).toBe("cand-456");
    expect(entry.stage).toBe("init");
    expect(entry.timestamp).toBeDefined();

    // Verify valid single line JSON
    expect(raw).not.toContain("\n");
    const parsed = JSON.parse(raw);
    expect(parsed.jobId).toBe("job-123");
    expect(parsed.level).toBe("info");
  });
  test("filters logs below the configured log level", () => {
    setLogLevel("warn");

    logger.debug("Debug message");
    logger.info("Info message");
    logger.warn("Warning message");
    logger.error("Error message");

    expect(capturedEntries.length).toBe(2);
    expect(capturedEntries[0]?.level).toBe("warn");
    expect(capturedEntries[1]?.level).toBe("error");
  });
  test("redacts secrets inside log messages", () => {
    const secretKey = "sk-ant-api03-abcdef123456789012345678";
    logger.warn(`Failed with key: ${secretKey}`);

    expect(capturedEntries.length).toBe(1);
    expect(capturedEntries[0]?.message).not.toContain(secretKey);
    expect(capturedEntries[0]?.message).toContain("[REDACTED]");
    expect(capturedRawJson[0]).toBeDefined();
    expect(capturedRawJson[0] ?? "").not.toContain(secretKey);
  });

  test("redacts sensitive keys in data objects", () => {
    logger.info("Provider request payload", {
      data: {
        provider: "anthropic",
        apiKey: "sk-ant-testkey1234567890123456",
        authorization: "Bearer secret-token-1234567890",
        "x-api-key": "secret-x-api-key-value",
        password: "supersecretpassword",
        nested: {
          token: "jwt.token.here",
          credential: "cert-credentials",
          safeField: "safe-value",
        },
      },
    });

    expect(capturedEntries.length).toBe(1);
    const firstEntry = capturedEntries[0];
    if (!firstEntry) throw new Error("Missing entry");
    const data = firstEntry.data;
    expect(data && typeof data === "object").toBe(true);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const rec = data as Record<string, unknown>;
      expect(rec.apiKey).toBe("[REDACTED]");
      expect(rec.authorization).toBe("[REDACTED]");
      expect(rec["x-api-key"]).toBe("[REDACTED]");
      expect(rec.password).toBe("[REDACTED]");

      const nested = rec.nested;
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        const nestedRec = nested as Record<string, unknown>;
        expect(nestedRec.token).toBe("[REDACTED]");
        expect(nestedRec.credential).toBe("[REDACTED]");
        expect(nestedRec.safeField).toBe("safe-value");
      }
    }

    expect(capturedRawJson[0]).not.toContain("supersecretpassword");
    expect(capturedRawJson[0]).not.toContain("sk-ant-testkey");
  });

  test("sanitizes Error instances in data and redacts secrets in error stacks/messages", () => {
    const errorWithSecret = Object.assign(
      new Error("Provider failed with key sk-ant-secretkey1234567890123456"),
      { code: "ERR_AUTH" },
    );
    logger.error("Execution failed", {
      errorCode: "ERR_AUTH",
      data: { error: errorWithSecret },
    });

    const secondEntry = capturedEntries[0];
    if (!secondEntry) throw new Error("Missing entry");
    const data = secondEntry.data;
    expect(data && typeof data === "object").toBe(true);
    if (data && typeof data === "object" && "error" in data) {
      const err = data.error;
      if (err && typeof err === "object") {
        const errRec = err as Record<string, unknown>;
        expect(errRec.name).toBe("Error");
        expect(String(errRec.message)).toContain("[REDACTED]");
        expect(String(errRec.message)).not.toContain("sk-ant-secretkey");
      }
    }
    expect(capturedRawJson[0]).not.toContain("sk-ant-secretkey");
  });

  test("safely handles circular references in data", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;

    expect(() => {
      logger.info("Circular log", { data: circular });
    }).not.toThrow();

    const thirdEntry = capturedEntries[0];
    if (!thirdEntry) throw new Error("Missing entry");
    const data = thirdEntry.data;
    if (data && typeof data === "object" && "self" in data) {
      expect((data as Record<string, unknown>).self).toBe("[Circular]");
    }
  });

  test("supports isolated Logger instances with independent sinks and levels", () => {
    const isolatedEntries: LogEntry[] = [];
    const customLogger = new Logger({
      minLevel: "error",
      sink: (entry) => isolatedEntries.push(entry),
    });

    customLogger.info("Should be ignored");
    customLogger.error("Critical failure");

    expect(isolatedEntries.length).toBe(1);
    expect(isolatedEntries[0]?.message).toBe("Critical failure");
  });
});
