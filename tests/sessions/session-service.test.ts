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
import { type CreateSessionRequest, SessionError } from "../../src/domain";
import { SessionService } from "../../src/sessions/service";

describe("Session Filesystem Service", () => {
  let tempOutputs: string;
  let service: SessionService;

  beforeAll(() => {
    tempOutputs = path.join(tmpdir(), `renderloom-test-service-${Date.now()}`);
    mkdirSync(tempOutputs, { recursive: true });
    service = new SessionService(tempOutputs);
  });

  afterAll(() => {
    rmSync(tempOutputs, { recursive: true, force: true });
  });

  const sampleRequest: CreateSessionRequest = {
    name: "Swiss Style Poster",
    providerId: "openai",
    modelId: "gpt-4o",
    styleId: "swiss",
    width: 1200,
    height: 800,
  };

  test("createSession creates folder layout and versioned metadata", async () => {
    const session = await service.createSession(
      sampleRequest,
      "Design an authentic Swiss typography poster",
    );

    expect(session.id).toBeDefined();
    expect(session.name).toBe("Swiss Style Poster");
    expect(session.slug).toBe("swiss-style-poster");

    const sessionDir = path.join(tempOutputs, session.slug);
    expect(existsSync(path.join(sessionDir, "session.json"))).toBe(true);
    expect(existsSync(path.join(sessionDir, "conversation.json"))).toBe(true);
    expect(existsSync(path.join(sessionDir, "prompt.snapshot.txt"))).toBe(true);
    expect(existsSync(path.join(sessionDir, "generation-config.json"))).toBe(
      true,
    );
    expect(existsSync(path.join(sessionDir, "images"))).toBe(true);
    expect(existsSync(path.join(sessionDir, "source"))).toBe(true);
    expect(existsSync(path.join(sessionDir, "svg"))).toBe(true);
    expect(existsSync(path.join(sessionDir, "assets"))).toBe(true);

    const snapshot = readFileSync(
      path.join(sessionDir, "prompt.snapshot.txt"),
      "utf-8",
    );
    expect(snapshot).toBe("Design an authentic Swiss typography poster");
  });

  test("duplicate names generate collision-safe slugs", async () => {
    const s1 = await service.createSession({
      ...sampleRequest,
      name: "Bauhaus Card",
    });
    const s2 = await service.createSession({
      ...sampleRequest,
      name: "Bauhaus Card",
    });

    expect(s1.slug).toBe("bauhaus-card");
    expect(s2.slug).toBe("bauhaus-card-2");
    expect(s1.id).not.toBe(s2.id);
  });

  test("listSessions returns sessions sorted by recent activity", async () => {
    const list = await service.listSessions();
    expect(list.length).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < list.length - 1; i++) {
      const current = list[i];
      const next = list[i + 1];
      if (current && next) {
        const a = new Date(current.updatedAt).getTime();
        const b = new Date(next.updatedAt).getTime();
        expect(a).toBeGreaterThanOrEqual(b);
      }
    }
  });

  test("listSessions isolates corrupt metadata without crashing", async () => {
    // Create a corrupt session folder
    const corruptDir = path.join(tempOutputs, "corrupt-session-folder");
    mkdirSync(corruptDir, { recursive: true });
    writeFileSync(
      path.join(corruptDir, "session.json"),
      "{ invalid JSON content !!!",
    );

    const list = await service.listSessions();
    expect(list.length).toBeGreaterThanOrEqual(3);
    const foundCorrupt = list.find((s) => s.slug === "corrupt-session-folder");
    expect(foundCorrupt).toBeUndefined();
  });

  test("getSession loads full session with conversation and artifacts", async () => {
    const created = await service.createSession(
      { ...sampleRequest, name: "Reopen Test" },
      "Initial instructions",
    );

    // Save sample artifacts
    await service.saveArtifact(
      created.id,
      "source",
      "design-001-v001.jsx",
      "export default function Design() { return <div />; }",
    );
    await service.saveArtifact(
      created.id,
      "svg",
      "design-001-v001.svg",
      "<svg></svg>",
    );

    const full = await service.getSession(created.id);
    expect(full.session.name).toBe("Reopen Test");
    expect(full.promptSnapshot).toBe("Initial instructions");
    expect(full.conversation.messages.length).toBe(1);
    expect(full.conversation.messages[0]?.content).toBe("Initial instructions");
    expect(full.artifacts.source).toContain("design-001-v001.jsx");
    expect(full.artifacts.svg).toContain("design-001-v001.svg");
  });

  test("renameSession updates session display name and timestamp", async () => {
    const session = await service.createSession({
      ...sampleRequest,
      name: "Before Rename",
    });
    const originalUpdated = session.updatedAt;

    const renamed = await service.renameSession(session.id, "After Rename");
    expect(renamed.name).toBe("After Rename");
    expect(renamed.slug).toBe(session.slug); // slug unchanged

    const reloaded = await service.getSession(session.id);
    expect(reloaded.session.name).toBe("After Rename");
    expect(
      new Date(reloaded.session.updatedAt).getTime(),
    ).toBeGreaterThanOrEqual(new Date(originalUpdated).getTime());
  });

  test("saveArtifact enforces immutable version protection", async () => {
    const session = await service.createSession({
      ...sampleRequest,
      name: "Immutable Test",
    });

    await service.saveArtifact(
      session.id,
      "images",
      "design-001-v001.png",
      new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    );

    // Second write to same version filename must fail
    expect(
      service.saveArtifact(
        session.id,
        "images",
        "design-001-v001.png",
        new Uint8Array([1, 2, 3]),
      ),
    ).rejects.toThrow(SessionError);
  });

  test("getArtifactPath resolves correct path and MIME type", async () => {
    const session = await service.createSession({
      ...sampleRequest,
      name: "Mime Test",
    });

    await service.saveArtifact(
      session.id,
      "images",
      "design-001-v001.png",
      "dummy-png",
    );
    await service.saveArtifact(
      session.id,
      "svg",
      "design-001-v001.svg",
      "<svg/>",
    );

    const png = await service.getArtifactPath(
      session.id,
      "images",
      "design-001-v001.png",
    );
    expect(png.mimeType).toBe("image/png");
    expect(existsSync(png.filePath)).toBe(true);

    const svg = await service.getArtifactPath(
      session.id,
      "svg",
      "design-001-v001.svg",
    );
    expect(svg.mimeType).toBe("image/svg+xml");

    // Missing artifact
    expect(
      service.getArtifactPath(session.id, "images", "missing.png"),
    ).rejects.toThrow(SessionError);
  });

  test("deleteSession cleanly removes session directory", async () => {
    const session = await service.createSession({
      ...sampleRequest,
      name: "To Delete",
    });
    const dir = path.join(tempOutputs, session.slug);
    expect(existsSync(dir)).toBe(true);

    await service.deleteSession(session.id);
    expect(existsSync(dir)).toBe(false);

    expect(service.getSession(session.id)).rejects.toThrow(SessionError);
  });
});
