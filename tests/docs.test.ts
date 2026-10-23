// tests/docs.test.ts
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

describe("Baseline Documentation & Default Prompt", () => {
  test("documentation files exist and are populated", () => {
    expect(existsSync("LOG.md")).toBe(true);
    expect(existsSync("README.md")).toBe(true);
    expect(existsSync("prompt.txt")).toBe(true);

    const log = readFileSync("LOG.md", "utf-8");
    expect(log).toContain("# Renderloom Implementation Log");

    const readme = readFileSync("README.md", "utf-8");
    expect(readme).toContain("# Renderloom");
    expect(readme).toContain("bun install");

    const prompt = readFileSync("prompt.txt", "utf-8");
    expect(prompt.length).toBeGreaterThan(50);
    expect(prompt).toContain("JSX");
  });
});
