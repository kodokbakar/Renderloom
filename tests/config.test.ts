import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

describe("Project Configuration", () => {
  test("essential configuration files exist", () => {
    expect(existsSync("package.json")).toBe(true);
    expect(existsSync("tsconfig.json")).toBe(true);
    expect(existsSync("biome.json")).toBe(true);
    expect(existsSync(".gitignore")).toBe(true);
  });

  test(".gitignore includes secret and output paths", () => {
    const gitignore = readFileSync(".gitignore", "utf-8");
    expect(gitignore).toContain("node_modules");
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain("Outputs/");
    expect(gitignore).toContain("dist/");
  });

  test("package.json defines required scripts", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
    expect(pkg.scripts.test).toBe("bun test");
    expect(pkg.scripts.typecheck).toBeDefined();
    expect(pkg.scripts.lint).toBeDefined();
    expect(pkg.scripts.build).toBeDefined();
  });
});
