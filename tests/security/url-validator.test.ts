import { describe, expect, test } from "bun:test";
import { ValidationError } from "../../src/domain";
import { validateBaseUrl } from "../../src/security/url";

describe("Base URL Security Validator", () => {
  test("accepts valid standard URLs and strips trailing slash", () => {
    expect(validateBaseUrl("https://api.openai.com/v1/")).toBe(
      "https://api.openai.com/v1",
    );
    expect(validateBaseUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1",
    );
    expect(validateBaseUrl("https://api.anthropic.com/")).toBe(
      "https://api.anthropic.com",
    );
  });

  test("allows loopback when allowCustom is true", () => {
    expect(validateBaseUrl("http://localhost:11434/v1/", true)).toBe(
      "http://localhost:11434/v1",
    );
    expect(validateBaseUrl("http://127.0.0.1:8000/v1", true)).toBe(
      "http://127.0.0.1:8000/v1",
    );
    expect(validateBaseUrl("http://[::1]:11434", true)).toBe(
      "http://[::1]:11434",
    );
  });

  test("rejects loopback and private IPs when allowCustom is false", () => {
    expect(() => validateBaseUrl("http://localhost:11434/v1", false)).toThrow(
      ValidationError,
    );
    expect(() => validateBaseUrl("http://127.0.0.1:8000", false)).toThrow(
      ValidationError,
    );
    expect(() => validateBaseUrl("http://192.168.1.100:8000", false)).toThrow(
      ValidationError,
    );
    expect(() => validateBaseUrl("http://10.0.0.1:8000", false)).toThrow(
      ValidationError,
    );
  });

  test("rejects non-HTTP protocols", () => {
    expect(() => validateBaseUrl("file:///etc/passwd")).toThrow(
      ValidationError,
    );
    expect(() => validateBaseUrl("ftp://example.com/api")).toThrow(
      ValidationError,
    );
    expect(() => validateBaseUrl("javascript:alert(1)")).toThrow(
      ValidationError,
    );
    expect(() => validateBaseUrl("data:text/plain;base64,SGVsbG8=")).toThrow(
      ValidationError,
    );
  });

  test("rejects embedded credentials in URL", () => {
    expect(() =>
      validateBaseUrl("https://user:password@api.openai.com/v1"),
    ).toThrow(ValidationError);
    expect(() => validateBaseUrl("https://api-key@api.openai.com/v1")).toThrow(
      ValidationError,
    );
  });

  test("rejects path traversal attempts", () => {
    expect(() =>
      validateBaseUrl("https://api.openai.com/v1/../../etc/passwd"),
    ).toThrow(ValidationError);
    expect(() => validateBaseUrl("https://api.openai.com/v1/..")).toThrow(
      ValidationError,
    );
    expect(() =>
      validateBaseUrl("http://localhost:11434/%2e%2e/admin", true),
    ).toThrow(ValidationError);
  });

  test("strictly blocks cloud metadata endpoints even with allowCustom=true", () => {
    // AWS / GCP / Azure link-local metadata
    expect(() =>
      validateBaseUrl("http://169.254.169.254/latest/meta-data/", true),
    ).toThrow(ValidationError);

    // Google Cloud internal metadata
    expect(() =>
      validateBaseUrl(
        "http://metadata.google.internal/computeMetadata/v1/",
        true,
      ),
    ).toThrow(ValidationError);

    // Alibaba cloud metadata
    expect(() =>
      validateBaseUrl("http://100.100.100.200/latest/meta-data/", true),
    ).toThrow(ValidationError);

    // IPv6 link-local cloud metadata
    expect(() =>
      validateBaseUrl("http://[fd00:ec2::254]/latest/meta-data/", true),
    ).toThrow(ValidationError);

    // Bare metadata host
    expect(() => validateBaseUrl("http://metadata/meta-data", true)).toThrow(
      ValidationError,
    );
  });
});
