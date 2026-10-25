import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateSampleSession } from "../../scripts/generate-sample-session";
import {
  MAX_ASSET_BYTES,
  MAX_AST_DEPTH,
  MAX_AST_NODES,
  MAX_RENDER_DURATION_MS,
  MAX_SVG_BYTES,
} from "../../src/domain/dimensions";
import { AnthropicAdapter } from "../../src/llm/adapters/anthropic";
import { OpenAIAdapter } from "../../src/llm/adapters/openai";
import { SessionService } from "../../src/sessions/service";
import { validateStylePreset } from "../../src/styles/schema";
describe("Documentation Edge Cases and Release Gates", () => {
  const rootDir = path.resolve(__dirname, "../..");

  test("verifies all internal relative markdown links across docs and README resolve to real files", async () => {
    const docFiles = [
      "README.md",
      "CONTRIBUTING.md",
      "CODE_OF_CONDUCT.md",
      "THIRD_PARTY_LICENSES.md",
      "docs/providers.md",
      "docs/renderer-satori.md",
      "docs/prompts-and-styles.md",
      "docs/outputs-and-sessions.md",
      ".github/ISSUE_TEMPLATE/bug_report.md",
      ".github/ISSUE_TEMPLATE/feature_request.md",
    ];

    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let checkedCount = 0;

    for (const relFile of docFiles) {
      const fullPath = path.join(rootDir, relFile);
      expect(existsSync(fullPath)).toBe(true);

      const content = await readFile(fullPath, "utf-8");
      for (const match of content.matchAll(linkRegex)) {
        const target = match[2];
        if (
          !target ||
          target.startsWith("http://") ||
          target.startsWith("https://") ||
          target.startsWith("mailto:") ||
          target.startsWith("#")
        ) {
          continue;
        }

        // Strip anchor if present
        const [cleanTarget] = target.split("#");
        if (!cleanTarget) continue;

        const resolvedTarget = path.resolve(
          path.dirname(fullPath),
          cleanTarget,
        );
        const exists = existsSync(resolvedTarget);
        expect(exists).toBe(true);
        checkedCount++;
      }
    }

    expect(checkedCount).toBeGreaterThanOrEqual(8);
  });

  test("verifies documented technical limits exactly match runtime constants in dimensions.ts", async () => {
    const rendererDoc = await readFile(
      path.join(rootDir, "docs/renderer-satori.md"),
      "utf-8",
    );

    expect(rendererDoc).toContain(`MAX_AST_DEPTH\` | \`${MAX_AST_DEPTH}\``);
    expect(rendererDoc).toContain(
      `MAX_AST_NODES\` | \`${MAX_AST_NODES.toLocaleString()}\``,
    );
    expect(rendererDoc).toContain(
      `MAX_ASSET_BYTES\` | \`5 MB\` (\`${MAX_ASSET_BYTES.toLocaleString()} B\`)`,
    );
    expect(rendererDoc).toContain(
      `MAX_SVG_BYTES\` | \`10 MB\` (\`${MAX_SVG_BYTES.toLocaleString()} B\`)`,
    );
    expect(rendererDoc).toContain(
      `MAX_RENDER_DURATION_MS\` | \`${MAX_RENDER_DURATION_MS.toLocaleString()} ms\``,
    );
  });

  test("verifies documented providers and models match LLM adapter metadata", async () => {
    const providersDoc = await readFile(
      path.join(rootDir, "docs/providers.md"),
      "utf-8",
    );

    const openai = new OpenAIAdapter();
    const anthropic = new AnthropicAdapter();

    expect(openai.meta.supportsCustomBaseUrl).toBe(true);
    expect(anthropic.meta.supportsCustomBaseUrl).toBe(false);

    for (const model of openai.meta.models) {
      expect(providersDoc).toContain(model.id);
    }

    for (const model of anthropic.meta.models) {
      expect(providersDoc).toContain(model.id);
    }
  });

  test("verifies all style presets in style-presets/ match documented schema and load via validateStylePreset", async () => {
    const presetsDir = path.join(rootDir, "style-presets");
    const entries = await readdir(presetsDir, { withFileTypes: true });
    const jsonFiles = entries
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .map((e) => e.name);

    const expectedStyles = [
      "bauhaus.json",
      "brutalist.json",
      "swiss.json",
      "minimal.json",
      "editorial.json",
    ];

    for (const expected of expectedStyles) {
      expect(jsonFiles).toContain(expected);
    }

    for (const jsonFile of jsonFiles) {
      const content = await readFile(path.join(presetsDir, jsonFile), "utf-8");
      const parsed = JSON.parse(content);
      const validated = validateStylePreset(parsed);

      expect(validated.schemaVersion).toBe(1);
      expect(validated.id).toBeDefined();
      expect(validated.name).toBeDefined();
      expect(validated.palette.background).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      expect(validated.palette.foreground).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      expect(validated.designPrinciples.length).toBeGreaterThan(0);
    }
  });

  test("verifies sample session generator CLI execution in an isolated directory via subprocess", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "renderloom-cli-"));
    const scriptPath = path.join(
      rootDir,
      "scripts",
      "generate-sample-session.ts",
    );

    try {
      const proc = Bun.spawn(["bun", "run", scriptPath], {
        cwd: tempDir,
        stdout: "pipe",
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();

      expect(exitCode).toBe(0);
      expect(stderr).toBe("");
      expect(stdout).toContain("Successfully generated sample session at:");

      const generatedOutputs = path.join(tempDir, "Outputs");
      expect(existsSync(generatedOutputs)).toBe(true);

      const service = new SessionService(generatedOutputs);
      const session = await service.getSession("bauhaus-geometric-poster");

      expect(session.session.name).toBe("Bauhaus Geometric Poster");
      expect(session.session.candidates?.length).toBe(2);
      expect(session.conversation.messages.length).toBe(2);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("verifies sample generator handles deeply nested non-existent output paths and idempotent re-runs", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "renderloom-nested-"));
    const nestedOutputDir = path.join(
      tempDir,
      "deeply",
      "nested",
      "custom",
      "path",
    );

    try {
      // First run: should create nested directories automatically
      const res1 = await generateSampleSession({ outputDir: nestedOutputDir });
      expect(existsSync(res1.sessionDir)).toBe(true);
      expect(res1.slug).toBe("bauhaus-geometric-poster");

      // Second run: should safely succeed into existing directory and disambiguate slug
      const res2 = await generateSampleSession({ outputDir: nestedOutputDir });
      expect(existsSync(res2.sessionDir)).toBe(true);
      expect(res2.slug).toBe("bauhaus-geometric-poster-2");

      const service = new SessionService(nestedOutputDir);
      const sessions = await service.listSessions();
      expect(sessions.length).toBe(2);
      const session = await service.getSession(res2.slug);
      expect(session.session.slug).toBe("bauhaus-geometric-poster-2");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("verifies generated PNG and SVG exact pixel dimensions and aspect ratio", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "renderloom-dims-"));

    try {
      const res = await generateSampleSession({ outputDir: tempDir });
      const imagesDir = path.join(res.sessionDir, "images");
      const svgDir = path.join(res.sessionDir, "svg");

      const pngFiles = [
        "design-001-v001.png",
        "design-001-v002.png",
        "design-002-v001.png",
      ];
      for (const pngFile of pngFiles) {
        const buf = await readFile(path.join(imagesDir, pngFile));
        // PNG IHDR width at offset 16, height at offset 20
        const width = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);
        expect(width).toBe(1200);
        expect(height).toBe(1200);
      }

      const svgFiles = [
        "design-001-v001.svg",
        "design-001-v002.svg",
        "design-002-v001.svg",
      ];
      for (const svgFile of svgFiles) {
        const svgContent = await readFile(path.join(svgDir, svgFile), "utf-8");
        expect(svgContent).toContain('width="1200"');
        expect(svgContent).toContain('height="1200"');
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("verifies issue templates have valid YAML frontmatter and enforce required fields", async () => {
    const bugTemplate = await readFile(
      path.join(rootDir, ".github", "ISSUE_TEMPLATE", "bug_report.md"),
      "utf-8",
    );
    const featTemplate = await readFile(
      path.join(rootDir, ".github", "ISSUE_TEMPLATE", "feature_request.md"),
      "utf-8",
    );

    expect(bugTemplate.startsWith("---")).toBe(true);
    expect(featTemplate.startsWith("---")).toBe(true);

    expect(bugTemplate).toContain("name: Bug report");
    expect(bugTemplate).toContain("labels: bug");
    expect(bugTemplate).toContain("title: '[BUG] '");

    expect(featTemplate).toContain("name: Feature request");
    expect(featTemplate).toContain("labels: enhancement");
    expect(featTemplate).toContain("title: '[FEAT] '");
  });

  test("verifies governance documents have no unresolved placeholder tokens and enforce valid contact email", async () => {
    const governanceDocs = ["CONTRIBUTING.md", "CODE_OF_CONDUCT.md"];
    const placeholders = [
      "[INSERT",
      "[TODO",
      "TODO:",
      "FIXME:",
      "<your-email>",
      "example.com",
      "REPLACE_WITH",
    ];

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    for (const relFile of governanceDocs) {
      const content = await readFile(path.join(rootDir, relFile), "utf-8");
      for (const placeholder of placeholders) {
        expect(content.includes(placeholder)).toBe(false);
      }

      const mailtoMatches = Array.from(content.matchAll(/mailto:([^\s)]+)/g));
      expect(mailtoMatches.length).toBeGreaterThan(0);
      for (const match of mailtoMatches) {
        const email = match[1];
        expect(email).toBe("conduct@renderloom.dev");
        expect(emailRegex.test(email ?? "")).toBe(true);
      }
    }
  });

  test("verifies CONTRIBUTING.md resource limits and developer commands match project configuration", async () => {
    const contributing = await readFile(
      path.join(rootDir, "CONTRIBUTING.md"),
      "utf-8",
    );

    expect(contributing).toContain(`MAX_AST_DEPTH = ${MAX_AST_DEPTH}`);
    expect(contributing).toContain(`MAX_AST_NODES = ${MAX_AST_NODES}`);
    expect(contributing).toContain("MAX_ASSET_BYTES = 5 MB");
    expect(contributing).toContain("MAX_SVG_BYTES = 10 MB");
    expect(contributing).toContain(
      `MAX_RENDER_DURATION_MS = ${MAX_RENDER_DURATION_MS} ms`,
    );

    const pkg = JSON.parse(
      await readFile(path.join(rootDir, "package.json"), "utf-8"),
    );
    const workflowCommands = [
      "dev",
      "build",
      "test",
      "lint",
      "format",
      "typecheck",
    ];
    for (const cmd of workflowCommands) {
      const expectedInvocation =
        cmd === "test" ? "`bun test`" : `\`bun run ${cmd}\``;
      expect(contributing).toContain(expectedInvocation);
      expect(pkg.scripts[cmd]).toBeDefined();
    }
  });
});
