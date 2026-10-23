import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Server } from "bun";
import { createServer } from "../../src/server/server";
import { SessionService } from "../../src/sessions/service";

describe("Sessions HTTP API Endpoints", () => {
  let tempOutputs: string;
  let sessionService: SessionService;
  let server: Server<unknown>;
  let baseUrl: string;

  beforeAll(() => {
    tempOutputs = path.join(tmpdir(), `renderloom-test-api-${Date.now()}`);
    mkdirSync(tempOutputs, { recursive: true });
    sessionService = new SessionService(tempOutputs);
    server = createServer(0, sessionService);
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server.stop();
    rmSync(tempOutputs, { recursive: true, force: true });
  });

  test("GET /api/sessions returns empty list initially", async () => {
    const res = await fetch(`${baseUrl}/api/sessions`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.sessions)).toBe(true);
  });

  test("POST /api/sessions creates a new session", async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "API Test Poster",
        providerId: "openai",
        modelId: "gpt-4o",
        styleId: "bauhaus",
        width: 1080,
        height: 1080,
        initialPrompt: "Test prompt instructions",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.session).toBeDefined();
    expect(body.session.name).toBe("API Test Poster");
    expect(body.session.slug).toBe("api-test-poster");
  });

  test("POST /api/sessions returns 400 for invalid body", async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "", // empty name
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("GET /api/sessions/:id reopens full session state", async () => {
    // Create session first
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Reopen Via API",
        providerId: "anthropic",
        modelId: "claude-3-5-sonnet",
        styleId: "swiss",
        width: 800,
        height: 600,
        initialPrompt: "Reopen prompt",
      }),
    });
    const { session } = await createRes.json();

    const getRes = await fetch(`${baseUrl}/api/sessions/${session.id}`);
    expect(getRes.status).toBe(200);
    const full = await getRes.json();
    expect(full.session.id).toBe(session.id);
    expect(full.promptSnapshot).toBe("Reopen prompt");
    expect(full.artifacts.images).toBeDefined();
  });

  test("GET /api/sessions/:id returns 404 for unknown session", async () => {
    const res = await fetch(`${baseUrl}/api/sessions/non-existent-session-id`);
    expect(res.status).toBe(404);
  });

  test("PATCH /api/sessions/:id renames the session", async () => {
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Old Name",
        providerId: "openai",
        modelId: "gpt-4o",
        styleId: "minimal",
        width: 500,
        height: 500,
      }),
    });
    const { session } = await createRes.json();

    const patchRes = await fetch(`${baseUrl}/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name" }),
    });

    expect(patchRes.status).toBe(200);
    const body = await patchRes.json();
    expect(body.session.name).toBe("New Name");
  });

  test("DELETE /api/sessions/:id removes the session", async () => {
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Delete Me",
        providerId: "openai",
        modelId: "gpt-4o",
        styleId: "minimal",
        width: 500,
        height: 500,
      }),
    });
    const { session } = await createRes.json();

    const delRes = await fetch(`${baseUrl}/api/sessions/${session.id}`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(200);

    const getRes = await fetch(`${baseUrl}/api/sessions/${session.id}`);
    expect(getRes.status).toBe(404);
  });

  test("GET artifact endpoint serves file with correct MIME type and blocks traversal", async () => {
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Artifact API Session",
        providerId: "openai",
        modelId: "gpt-4o",
        styleId: "bauhaus",
        width: 800,
        height: 600,
      }),
    });
    const { session } = await createRes.json();

    // Save SVG and PNG artifacts
    await sessionService.saveArtifact(
      session.id,
      "svg",
      "design-001-v001.svg",
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>',
    );
    await sessionService.saveArtifact(
      session.id,
      "images",
      "design-001-v001.png",
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    // Fetch SVG
    const svgRes = await fetch(
      `${baseUrl}/api/sessions/${session.id}/artifacts/svg/design-001-v001.svg`,
    );
    expect(svgRes.status).toBe(200);
    expect(svgRes.headers.get("Content-Type")).toContain("image/svg+xml");
    const svgText = await svgRes.text();
    expect(svgText).toContain("<svg");

    // Fetch PNG
    const pngRes = await fetch(
      `${baseUrl}/api/sessions/${session.id}/artifacts/images/design-001-v001.png`,
    );
    expect(pngRes.status).toBe(200);
    expect(pngRes.headers.get("Content-Type")).toContain("image/png");

    // Traversal attack
    const traversalRes = await fetch(
      `${baseUrl}/api/sessions/${session.id}/artifacts/images/..%2F..%2Fetc%2Fpasswd`,
    );
    expect(traversalRes.status).toBe(400);

    // Missing artifact
    const missingRes = await fetch(
      `${baseUrl}/api/sessions/${session.id}/artifacts/images/missing.png`,
    );
    expect(missingRes.status).toBe(404);
  });
});
