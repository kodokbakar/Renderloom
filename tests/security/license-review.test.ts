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

describe("License Review and Compliance Suite", () => {
  const rootDir = path.resolve(__dirname, "../..");

  test("verifies project root license is GPL-3.0-or-later and contains copyright notice", async () => {
    const pkgPath = path.join(rootDir, "package.json");
    expect(existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
    expect(pkg.license).toBe("GPL-3.0-or-later");

    const licensePath = path.join(rootDir, "LICENSE");
    expect(existsSync(licensePath)).toBe(true);
    const licenseText = await readFile(licensePath, "utf-8");
    expect(licenseText).toContain("GNU GENERAL PUBLIC LICENSE");
    expect(licenseText).toContain("Version 3, 29 June 2007");
    expect(licenseText).toContain("Copyright (C) 2026 Renderloom Contributors");
    expect(licenseText).toContain(
      "This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License",
    );
  });

  test("verifies all runtime production dependencies are GPL-3.0 compatible and documented in THIRD_PARTY_LICENSES.md", async () => {
    const thirdPartyPath = path.join(rootDir, "THIRD_PARTY_LICENSES.md");
    expect(existsSync(thirdPartyPath)).toBe(true);
    const thirdPartyContent = await readFile(thirdPartyPath, "utf-8");

    const pkgPath = path.join(rootDir, "package.json");
    const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
    const dependencies = Object.keys(pkg.dependencies ?? {});
    expect(dependencies.length).toBeGreaterThan(0);

    const GPLV3_COMPATIBLE_LICENSES: Record<string, true> = {
      MIT: true,
      "Apache-2.0": true,
      "BSD-2-Clause": true,
      "BSD-3-Clause": true,
      ISC: true,
      "MPL-2.0": true,
    };

    for (const dep of dependencies) {
      expect(thirdPartyContent).toContain(`| \`${dep}\` |`);

      const depPkgPath = path.join(
        rootDir,
        "node_modules",
        dep,
        "package.json",
      );
      const depPkg = JSON.parse(await readFile(depPkgPath, "utf-8"));
      const license =
        depPkg.license ?? (depPkg.licenses?.[0]?.type || depPkg.licenses?.[0]);
      expect(license).toBeDefined();
      expect(GPLV3_COMPATIBLE_LICENSES[license as string]).toBe(true);
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
