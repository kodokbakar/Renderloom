import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { containsSecret } from "../../src/security/redact";
import { SessionService } from "../../src/sessions/service";

describe("End-to-End Session Persistence & Reopen", () => {
  let tempOutputs: string;
  let service1: SessionService;

  beforeAll(() => {
    tempOutputs = path.join(
      tmpdir(),
      `renderloom-test-reopen-e2e-${Date.now()}`,
    );
    mkdirSync(tempOutputs, { recursive: true });
    service1 = new SessionService(tempOutputs);
  });

  afterAll(() => {
    rmSync(tempOutputs, { recursive: true, force: true });
  });

  test("lifecycle: create, save artifacts, restart service, and reopen intact", async () => {
    // 1. Create session with custom instructions
    const created = await service1.createSession(
      {
        name: "Bauhaus Minimalist Poster",
        providerId: "openai",
        modelId: "gpt-4o",
        styleId: "bauhaus",
        width: 1200,
        height: 1600,
      },
      "Create a bold primary-color Bauhaus design with geometric circles and clean typography",
    );

    const sessionId = created.id;
    const slug = created.slug;
    expect(slug).toBe("bauhaus-minimalist-poster");

    // 2. Save artifacts representing completed generation versions
    const jsxContent =
      'export default function Design() { return <div style={{ display: "flex", backgroundColor: "#d02b2b" }}>Bauhaus</div>; }';
    const svgContent =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect fill="#d02b2b" width="1200" height="1600"/></svg>';
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    await service1.saveArtifact(
      sessionId,
      "source",
      "design-001-v001.jsx",
      jsxContent,
    );
    await service1.saveArtifact(
      sessionId,
      "svg",
      "design-001-v001.svg",
      svgContent,
    );
    await service1.saveArtifact(
      sessionId,
      "images",
      "design-001-v001.png",
      pngBytes,
    );

    // 3. Inject a corrupt sibling session directory to test isolation
    const corruptDir = path.join(tempOutputs, "bad-corrupt-session");
    mkdirSync(corruptDir, { recursive: true });
    writeFileSync(path.join(corruptDir, "session.json"), "{{ corrupted JSON");

    // 4. Restart service instance (simulate fresh process start)
    const service2 = new SessionService(tempOutputs);

    // Verify listSessions ignores corrupt sibling and returns valid session
    const list = await service2.listSessions();
    expect(list.some((s) => s.id === sessionId)).toBe(true);
    expect(list.some((s) => s.slug === "bad-corrupt-session")).toBe(false);

    // 5. Reopen full session
    const reopened = await service2.getSession(sessionId);
    expect(reopened.session.id).toBe(sessionId);
    expect(reopened.session.name).toBe("Bauhaus Minimalist Poster");
    expect(reopened.session.dimensions.width).toBe(1200);
    expect(reopened.session.dimensions.height).toBe(1600);
    expect(reopened.promptSnapshot).toContain("Bauhaus design");
    expect(reopened.conversation.messages.length).toBe(1);
    expect(reopened.conversation.messages[0]?.content).toContain(
      "geometric circles",
    );
    expect(reopened.generationConfig.styleId).toBe("bauhaus");
    expect(reopened.generationConfig.candidateCount).toBe(1);

    // Artifacts present
    expect(reopened.artifacts.source).toContain("design-001-v001.jsx");
    expect(reopened.artifacts.svg).toContain("design-001-v001.svg");
    expect(reopened.artifacts.images).toContain("design-001-v001.png");

    // 6. Verify zero secrets persisted anywhere on disk
    const sessionDir = path.join(tempOutputs, slug);
    const allFiles = readdirSync(sessionDir, {
      recursive: true,
      withFileTypes: true,
    });

    for (const file of allFiles) {
      if (file.isFile()) {
        const fullPath = path.join(file.parentPath ?? sessionDir, file.name);
        const data = readFileSync(fullPath);
        // Check text representations
        const asText = data.toString("utf-8");
        expect(containsSecret(asText)).toBe(false);
        expect(asText).not.toContain("sk-");
        expect(asText).not.toContain("Bearer ");
      }
    }
  });
});
