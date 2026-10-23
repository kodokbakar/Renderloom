import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SessionError } from "../../src/domain";
import {
  resolveOutputsDir,
  validateArtifactPath,
  validateSessionPath,
} from "../../src/sessions/paths";

describe("Filesystem Path Security & Traversal Guards", () => {
  let tempBase: string;
  let outsideDir: string;

  beforeAll(() => {
    tempBase = path.join(tmpdir(), `renderloom-test-paths-${Date.now()}`);
    outsideDir = path.join(tmpdir(), `renderloom-test-outside-${Date.now()}`);
    mkdirSync(tempBase, { recursive: true });
    mkdirSync(outsideDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tempBase, { recursive: true, force: true });
    rmSync(outsideDir, { recursive: true, force: true });
  });

  test("resolves default outputs directory or custom path", () => {
    const custom = resolveOutputsDir("/custom/path");
    expect(custom).toBe(path.resolve("/custom/path"));

    const def = resolveOutputsDir();
    expect(def).toBe(path.resolve(process.cwd(), "Outputs"));
  });

  test("accepts valid session slugs", () => {
    const valid = validateSessionPath(tempBase, "my-session-01");
    expect(valid).toBe(path.join(tempBase, "my-session-01"));
  });

  test("rejects directory traversal attempts", () => {
    expect(() => validateSessionPath(tempBase, "../evil")).toThrow(
      SessionError,
    );
    expect(() => validateSessionPath(tempBase, "../../etc/passwd")).toThrow(
      SessionError,
    );
    expect(() => validateSessionPath(tempBase, "foo/../../bar")).toThrow(
      SessionError,
    );
    expect(() => validateSessionPath(tempBase, "foo\\bar")).toThrow(
      SessionError,
    );
    expect(() => validateSessionPath(tempBase, "foo\0bar")).toThrow(
      SessionError,
    );
  });

  test("rejects uppercase or invalid characters in slugs", () => {
    expect(() => validateSessionPath(tempBase, "MySession")).toThrow(
      SessionError,
    );
    expect(() => validateSessionPath(tempBase, "session*bad")).toThrow(
      SessionError,
    );
    expect(() => validateSessionPath(tempBase, "")).toThrow(SessionError);
  });

  test("blocks symlink escapes outside the outputs boundary", () => {
    const symlinkPath = path.join(tempBase, "escaped-link");
    try {
      symlinkSync(outsideDir, symlinkPath, "dir");
    } catch {
      // If symlink not supported in test environment, skip
      return;
    }

    expect(() => validateSessionPath(tempBase, "escaped-link")).toThrow(
      SessionError,
    );
  });

  test("validates safe artifact paths", () => {
    const sessionDir = path.join(tempBase, "test-sess");
    mkdirSync(path.join(sessionDir, "images"), { recursive: true });

    const artifact = validateArtifactPath(
      tempBase,
      "test-sess",
      "images",
      "design-001-v001.png",
    );
    expect(artifact).toBe(
      path.join(tempBase, "test-sess", "images", "design-001-v001.png"),
    );
  });

  test("rejects unsafe artifact paths and unknown directories", () => {
    expect(() =>
      validateArtifactPath(tempBase, "test-sess", "secrets", "file.txt"),
    ).toThrow(SessionError);

    expect(() =>
      validateArtifactPath(tempBase, "test-sess", "images", "../traversal.png"),
    ).toThrow(SessionError);

    expect(() =>
      validateArtifactPath(tempBase, "test-sess", "images", ".hidden.png"),
    ).toThrow(SessionError);

    expect(() =>
      validateArtifactPath(tempBase, "test-sess", "images", "foo/bar.png"),
    ).toThrow(SessionError);
  });
});
