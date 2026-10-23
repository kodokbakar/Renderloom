// tests/app/frontend.test.ts
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

describe("Frontend Scaffold", () => {
  test("Vite and React scaffold files exist", () => {
    expect(existsSync("index.html")).toBe(true);
    expect(existsSync("vite.config.ts")).toBe(true);
    expect(existsSync("src/app/main.tsx")).toBe(true);
    expect(existsSync("src/app/App.tsx")).toBe(true);
  });

  test("index.html points to client entry point", () => {
    const html = readFileSync("index.html", "utf-8");
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('src="/src/app/main.tsx"');
  });
});
