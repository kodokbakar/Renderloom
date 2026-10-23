import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ValidationError } from "../../src/domain";
import {
  atomicWriteFile,
  atomicWriteJson,
  cleanupOrphanedTempFiles,
} from "../../src/sessions/atomic";

describe("Atomic File Operations & Temp Cleanup", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = path.join(tmpdir(), `renderloom-test-atomic-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("atomicWriteFile writes text and binary cleanly", async () => {
    const textFile = path.join(tempDir, "file.txt");
    await atomicWriteFile(textFile, "hello atomic world");
    expect(readFileSync(textFile, "utf-8")).toBe("hello atomic world");

    const binaryFile = path.join(tempDir, "bin.dat");
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    await atomicWriteFile(binaryFile, bytes);
    expect(new Uint8Array(readFileSync(binaryFile))).toEqual(bytes);
  });

  test("atomicWriteJson writes valid JSON and rejects secrets", async () => {
    const jsonFile = path.join(tempDir, "data.json");
    const payload = { id: "123", valid: true, values: [1, 2, 3] };
    await atomicWriteJson(jsonFile, payload);

    const readBack = JSON.parse(readFileSync(jsonFile, "utf-8"));
    expect(readBack).toEqual(payload);

    const secretFile = path.join(tempDir, "secret.json");
    expect(
      atomicWriteJson(secretFile, {
        apiKey: "sk-proj-12345678901234567890123456",
      }),
    ).rejects.toThrow(ValidationError);
    expect(existsSync(secretFile)).toBe(false);
  });

  test("concurrent atomic writes do not corrupt the destination", async () => {
    const target = path.join(tempDir, "concurrent.json");
    const tasks = Array.from({ length: 20 }, (_, i) =>
      atomicWriteJson(target, { index: i, text: `payload-${i}`.repeat(50) }),
    );

    await Promise.all(tasks);
    const content = JSON.parse(readFileSync(target, "utf-8"));
    expect(typeof content.index).toBe("number");
    expect(content.text.startsWith("payload-")).toBe(true);
  });

  test("cleanupOrphanedTempFiles deletes leftover temporary files", async () => {
    const subDir = path.join(tempDir, "orphans");
    mkdirSync(subDir, { recursive: true });

    writeFileSync(path.join(subDir, ".session.json.uuid1.tmp"), "temp1");
    writeFileSync(path.join(subDir, ".session.json.uuid2.tmp"), "temp2");
    writeFileSync(path.join(subDir, "session.json"), '{"valid": true}');

    const cleaned = await cleanupOrphanedTempFiles(subDir);
    expect(cleaned).toBe(2);
    expect(existsSync(path.join(subDir, "session.json"))).toBe(true);
    expect(existsSync(path.join(subDir, ".session.json.uuid1.tmp"))).toBe(
      false,
    );
  });
});
