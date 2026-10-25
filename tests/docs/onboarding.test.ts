import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateSampleSession } from "../../scripts/generate-sample-session";
import { SessionService } from "../../src/sessions/service";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("Onboarding and MVP Documentation Suite", () => {
  const rootDir = path.resolve(__dirname, "../..");

  test("verifies core documentation files exist and contain required technical sections", async () => {
    const requiredFiles = [
      "README.md",
      "LICENSE",
      "CONTRIBUTING.md",
      "CODE_OF_CONDUCT.md",
      "THIRD_PARTY_LICENSES.md",
      "docs/providers.md",
      "docs/renderer-satori.md",
      "docs/prompts-and-styles.md",
      "docs/outputs-and-sessions.md",
    ];

    for (const file of requiredFiles) {
      const fullPath = path.join(rootDir, file);
      expect(existsSync(fullPath)).toBe(true);
      const content = await readFile(fullPath, "utf-8");
      expect(content.length).toBeGreaterThan(200);
    }

    // Verify README sections
    const readme = await readFile(path.join(rootDir, "README.md"), "utf-8");
    expect(readme).toContain("Key Features");
    expect(readme).toContain("Architecture Overview");
    expect(readme).toContain("Prerequisites");
    expect(readme).toContain("Quickstart");
    expect(readme).toContain("Developer Commands");
    expect(readme).toContain("Demo Workflow");
    expect(readme).toContain("Security Model");
    expect(readme).toContain("Technical Documentation");
    expect(readme).toContain("Contributing");
    expect(readme).toContain("License");

    // Verify LICENSE
    const license = await readFile(path.join(rootDir, "LICENSE"), "utf-8");
    expect(license).toContain("GNU GENERAL PUBLIC LICENSE");
    expect(license).toContain("Version 3, 29 June 2007");
    expect(license).toContain("Renderloom Contributors");

    // Verify CONTRIBUTING.md
    const contributing = await readFile(
      path.join(rootDir, "CONTRIBUTING.md"),
      "utf-8",
    );
    expect(contributing).toContain("Bun");
    expect(contributing).toContain("bun run dev");
    expect(contributing).toContain("bun test");
    expect(contributing).toContain("bun run lint");
    expect(contributing).toContain("bun run typecheck");
    expect(contributing).toContain("bun run build");
    expect(contributing).toContain("AST");
    expect(contributing).toContain("BYOK");
    expect(contributing).toContain("CODE_OF_CONDUCT.md");
    expect(contributing).toContain("GPL-3.0");

    // Verify CODE_OF_CONDUCT.md
    const coc = await readFile(
      path.join(rootDir, "CODE_OF_CONDUCT.md"),
      "utf-8",
    );
    expect(coc).toContain("Contributor Covenant");
    expect(coc).toContain("2.1");
    expect(coc).toContain("Our Pledge");
    expect(coc).toContain("Our Standards");
    expect(coc).toContain("Enforcement");
    // Verify THIRD_PARTY_LICENSES
    const thirdParty = await readFile(
      path.join(rootDir, "THIRD_PARTY_LICENSES.md"),
      "utf-8",
    );
    expect(thirdParty).toContain("@resvg/resvg-js");
    expect(thirdParty).toContain("satori");
    expect(thirdParty).toContain("react");
    expect(thirdParty).toContain("zod");
    expect(thirdParty).toContain("Roboto");
    expect(thirdParty).toContain("SIL Open Font License, Version 1.1");

    // Verify docs/providers.md
    const providersDoc = await readFile(
      path.join(rootDir, "docs/providers.md"),
      "utf-8",
    );
    expect(providersDoc).toContain("OpenAI");
    expect(providersDoc).toContain("Anthropic");
    expect(providersDoc).toContain("BYOK");
    expect(providersDoc).toContain("InMemoryKeyStore");
    expect(providersDoc).toContain("test-connection");
    expect(providersDoc).toContain("validateBaseUrl");

    // Verify docs/renderer-satori.md
    const rendererDoc = await readFile(
      path.join(rootDir, "docs/renderer-satori.md"),
      "utf-8",
    );
    expect(rendererDoc).toContain("Supported JSX Elements");
    expect(rendererDoc).toContain("Flexbox Only");
    expect(rendererDoc).toContain("MAX_AST_DEPTH");
    expect(rendererDoc).toContain("MAX_AST_NODES");
    expect(rendererDoc).toContain("MAX_ASSET_BYTES");
    expect(rendererDoc).toContain("MAX_SVG_BYTES");
    expect(rendererDoc).toContain("Roboto Regular");

    // Verify docs/prompts-and-styles.md
    const promptDoc = await readFile(
      path.join(rootDir, "docs/prompts-and-styles.md"),
      "utf-8",
    );
    expect(promptDoc).toContain("prompt.txt");
    expect(promptDoc).toContain("prompt.snapshot.txt");
    expect(promptDoc).toContain("Style Presets");
    expect(promptDoc).toContain("Revision Prompt Composition");

    // Verify docs/outputs-and-sessions.md
    const outputsDoc = await readFile(
      path.join(rootDir, "docs/outputs-and-sessions.md"),
      "utf-8",
    );
    expect(outputsDoc).toContain("session.json");
    expect(outputsDoc).toContain("conversation.json");
    expect(outputsDoc).toContain("generation-config.json");
    expect(outputsDoc).toContain("Immutable Artifacts and Versioning");
    expect(outputsDoc).toContain("Atomic Writes");
  });

  test("verifies GitHub issue templates exist and enforce credential safety warnings", async () => {
    const bugTemplatePath = path.join(
      rootDir,
      ".github",
      "ISSUE_TEMPLATE",
      "bug_report.md",
    );
    const featTemplatePath = path.join(
      rootDir,
      ".github",
      "ISSUE_TEMPLATE",
      "feature_request.md",
    );

    expect(existsSync(bugTemplatePath)).toBe(true);
    expect(existsSync(featTemplatePath)).toBe(true);

    const bugContent = await readFile(bugTemplatePath, "utf-8");
    expect(bugContent).toContain("SECURITY NOTICE");
    expect(bugContent).toContain("NEVER SHARE API KEYS");
    expect(bugContent).toContain("Steps to Reproduce");
    expect(bugContent).toContain("Environment");

    const featContent = await readFile(featTemplatePath, "utf-8");
    expect(featContent).toContain("Problem Statement");
    expect(featContent).toContain("Proposed Solution");
    expect(featContent).toContain(
      "Alignment with Renderloom Design Principles",
    );
  });

  test("verifies package.json scripts contain all required developer workflow commands", async () => {
    const pkgContent = await readFile(
      path.join(rootDir, "package.json"),
      "utf-8",
    );
    const pkg = JSON.parse(pkgContent);

    expect(pkg.scripts.dev).toBeDefined();
    expect(pkg.scripts.build).toBeDefined();
    expect(pkg.scripts.test).toBeDefined();
    expect(pkg.scripts.lint).toBeDefined();
    expect(pkg.scripts.format).toBeDefined();
    expect(pkg.scripts.typecheck).toBeDefined();
    expect(pkg.scripts["generate:sample"]).toBeDefined();
    expect(pkg.license).toBe("GPL-3.0-or-later");
  });

  test("verifies sample session generation creates valid candidates, versions, and binary assets", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "renderloom-sample-"));

    try {
      const result = await generateSampleSession({ outputDir: tempDir });
      expect(result.sessionDir).toBeDefined();
      expect(existsSync(result.sessionDir)).toBe(true);
      expect(result.slug).toBe("bauhaus-geometric-poster");

      // Check metadata files
      const sessionJsonPath = path.join(result.sessionDir, "session.json");
      const conversationJsonPath = path.join(
        result.sessionDir,
        "conversation.json",
      );
      const configJsonPath = path.join(
        result.sessionDir,
        "generation-config.json",
      );
      const promptSnapshotPath = path.join(
        result.sessionDir,
        "prompt.snapshot.txt",
      );

      expect(existsSync(sessionJsonPath)).toBe(true);
      expect(existsSync(conversationJsonPath)).toBe(true);
      expect(existsSync(configJsonPath)).toBe(true);
      expect(existsSync(promptSnapshotPath)).toBe(true);

      // Check artifacts
      const imagesDir = path.join(result.sessionDir, "images");
      const svgDir = path.join(result.sessionDir, "svg");
      const sourceDir = path.join(result.sessionDir, "source");

      const imageFiles = await readdir(imagesDir);
      const svgFiles = await readdir(svgDir);
      const sourceFiles = await readdir(sourceDir);

      expect(imageFiles).toContain("design-001-v001.png");
      expect(imageFiles).toContain("design-001-v002.png");
      expect(imageFiles).toContain("design-002-v001.png");

      expect(svgFiles).toContain("design-001-v001.svg");
      expect(svgFiles).toContain("design-001-v002.svg");
      expect(svgFiles).toContain("design-002-v001.svg");

      expect(sourceFiles).toContain("design-001-v001.jsx");
      expect(sourceFiles).toContain("design-001-v002.jsx");
      expect(sourceFiles).toContain("design-002-v001.jsx");

      // Verify PNG magic bytes
      for (const imgFile of imageFiles) {
        const imgBuffer = await readFile(path.join(imagesDir, imgFile));
        expect(imgBuffer.length).toBeGreaterThan(1000);
        expect(imgBuffer.subarray(0, 8)).toEqual(PNG_MAGIC);
      }

      // Verify SVG content
      for (const svgFile of svgFiles) {
        const svgContent = await readFile(path.join(svgDir, svgFile), "utf-8");
        expect(svgContent).toContain("<svg");
        expect(svgContent).toContain("</svg>");
      }

      // Verify JSX content
      for (const srcFile of sourceFiles) {
        const jsxContent = await readFile(
          path.join(sourceDir, srcFile),
          "utf-8",
        );
        expect(jsxContent).toContain("<div");
        expect(jsxContent).toContain("style={{");
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("verifies SessionService can cleanly reopen the generated sample session with full context", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "renderloom-reopen-"));

    try {
      const { slug } = await generateSampleSession({ outputDir: tempDir });

      const service = new SessionService(tempDir);
      const fullSession = await service.getSession(slug);

      expect(fullSession.session.name).toBe("Bauhaus Geometric Poster");
      expect(fullSession.session.styleId).toBe("bauhaus");
      expect(fullSession.session.candidates?.length).toBe(2);

      const candidate1 = fullSession.session.candidates?.find(
        (c) => c.id === "design-001",
      );
      expect(candidate1).toBeDefined();
      expect(candidate1?.currentVersionId).toBe("v002");
      const c1Versions = candidate1?.versions ?? [];
      expect(c1Versions.length).toBe(2);
      expect(c1Versions[0]?.id).toBe("v001");
      expect(c1Versions[1]?.id).toBe("v002");
      expect(c1Versions[1]?.parentVersionId).toBe("v001");

      const candidate2 = fullSession.session.candidates?.find(
        (c) => c.id === "design-002",
      );
      expect(candidate2).toBeDefined();
      expect(candidate2?.currentVersionId).toBe("v001");
      const c2Versions = candidate2?.versions ?? [];
      expect(c2Versions.length).toBe(1);

      // Verify conversation turns
      expect(fullSession.conversation.messages.length).toBe(2);
      expect(fullSession.conversation.messages[0]?.role).toBe("user");
      expect(fullSession.conversation.messages[1]?.role).toBe("user");
      expect(fullSession.conversation.messages[1]?.versionId).toBe("v002");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("verifies sample session files contain zero credentials or API key fragments", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "renderloom-secrets-"));

    try {
      const { sessionDir } = await generateSampleSession({
        outputDir: tempDir,
      });

      async function scanDirectory(dir: string): Promise<string[]> {
        const entries = await readdir(dir, { withFileTypes: true });
        const textContents: string[] = [];
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const nested = await scanDirectory(full);
            textContents.push(...nested);
          } else if (
            entry.name.endsWith(".json") ||
            entry.name.endsWith(".jsx") ||
            entry.name.endsWith(".svg") ||
            entry.name.endsWith(".txt")
          ) {
            textContents.push(await readFile(full, "utf-8"));
          }
        }
        return textContents;
      }

      const allTexts = await scanDirectory(sessionDir);
      for (const text of allTexts) {
        expect(text).not.toContain("sk-");
        expect(text).not.toContain("sk-ant-");
        expect(text).not.toContain("AIza");
        expect(text).not.toContain("Bearer ");
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
