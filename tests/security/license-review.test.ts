import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const APPROVED_LICENSES: Record<string, true> = {
  MIT: true,
  "Apache-2.0": true,
  "BSD-2-Clause": true,
  "BSD-3-Clause": true,
  ISC: true,
  "MPL-2.0": true,
};

describe("Dependency and Font License Review Suite", () => {
  const rootDir = process.cwd();

  test("verifies all runtime production dependencies have approved permissive licenses", async () => {
    const pkgPath = path.join(rootDir, "package.json");
    expect(existsSync(pkgPath)).toBe(true);

    const pkgContent = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgContent);

    const dependencies = pkg.dependencies ?? {};
    const depNames = Object.keys(dependencies);

    // Renderloom must have runtime dependencies declared
    expect(depNames.length).toBeGreaterThan(0);

    for (const dep of depNames) {
      const depPkgPath = path.join(
        rootDir,
        "node_modules",
        dep,
        "package.json",
      );
      expect(existsSync(depPkgPath)).toBe(true);

      const depContent = await readFile(depPkgPath, "utf-8");
      const depPkg = JSON.parse(depContent);

      const license =
        depPkg.license ?? (depPkg.licenses?.[0]?.type || depPkg.licenses?.[0]);
      expect(license).toBeDefined();
      expect(typeof license).toBe("string");

      const isApproved = APPROVED_LICENSES[license as string];
      expect(isApproved).toBe(true);
    }
  });

  test("verifies Roboto font binary is present and non-empty", async () => {
    const fontPath = path.join(
      rootDir,
      "src",
      "renderer",
      "fonts",
      "Roboto-Regular.ttf",
    );
    expect(existsSync(fontPath)).toBe(true);

    const stats = await stat(fontPath);
    expect(stats.size).toBeGreaterThan(1000);
  });

  test("verifies Roboto font license file contains SIL OFL 1.1 terms and copyright notice", async () => {
    const licensePath = path.join(
      rootDir,
      "src",
      "renderer",
      "fonts",
      "LICENSE.txt",
    );
    expect(existsSync(licensePath)).toBe(true);

    const licenseText = await readFile(licensePath, "utf-8");
    expect(licenseText.length).toBeGreaterThan(500);

    // Verify OFL 1.1 terms and attribution
    expect(licenseText).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(licenseText).toContain("SIL Open Font License, Version 1.1");
    expect(licenseText).toContain("Roboto Project Authors");
  });
});
