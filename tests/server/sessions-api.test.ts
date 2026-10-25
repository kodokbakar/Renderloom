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

    // Test updating providerId and modelId
    const patchModelRes = await fetch(`${baseUrl}/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "custom",
        modelId: "llama-3.3-70b-versatile",
      }),
    });
    expect(patchModelRes.status).toBe(200);
    const modelBody = await patchModelRes.json();
    expect(modelBody.session.providerId).toBe("custom");
    expect(modelBody.session.modelId).toBe("llama-3.3-70b-versatile");

    // Verify GET returns updated metadata and generationConfig
    const getUpdatedRes = await fetch(`${baseUrl}/api/sessions/${session.id}`);
    const getUpdatedBody = await getUpdatedRes.json();
    expect(getUpdatedBody.session.providerId).toBe("custom");
    expect(getUpdatedBody.session.modelId).toBe("llama-3.3-70b-versatile");
    expect(getUpdatedBody.generationConfig.providerId).toBe("custom");
    expect(getUpdatedBody.generationConfig.modelId).toBe(
      "llama-3.3-70b-versatile",
    );

    // Test rejection of empty update body
    const emptyPatchRes = await fetch(`${baseUrl}/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(emptyPatchRes.status).toBe(400);
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

  test("POST /api/sessions validates dimension boundaries and payload constraints", async () => {
    // width below minimum (64)
    const resLow = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dimension Test",
        providerId: "openai",
        modelId: "gpt-4o",
        styleId: "swiss",
        width: 32,
        height: 800,
      }),
    });
    expect(resLow.status).toBe(400);

    // height above maximum (4096)
    const resHigh = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dimension Test",
        providerId: "openai",
        modelId: "gpt-4o",
        styleId: "swiss",
        width: 800,
        height: 5000,
      }),
    });
    expect(resHigh.status).toBe(400);

    // Name exceeding 100 characters
    const resLongName = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "x".repeat(101),
        providerId: "openai",
        modelId: "gpt-4o",
        styleId: "swiss",
        width: 800,
        height: 800,
      }),
    });
    expect(resLongName.status).toBe(400);
  });

  test("PATCH and DELETE return 404 for non-existent session IDs", async () => {
    const patchRes = await fetch(
      `${baseUrl}/api/sessions/non-existent-id-404`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      },
    );
    expect(patchRes.status).toBe(404);

    const delRes = await fetch(`${baseUrl}/api/sessions/non-existent-id-404`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(404);
  });

  test("PATCH /api/sessions/:id validates rename payload constraints", async () => {
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Rename Constraint Test",
        providerId: "openai",
        modelId: "gpt-4o",
        styleId: "swiss",
        width: 800,
        height: 800,
      }),
    });
    const { session } = await createRes.json();

    // Empty name
    const emptyRes = await fetch(`${baseUrl}/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    expect(emptyRes.status).toBe(400);

    // Overlong name
    const longRes = await fetch(`${baseUrl}/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "a".repeat(101) }),
    });
    expect(longRes.status).toBe(400);
  });

  test("handles path traversal in session ID gracefully", async () => {
    const res = await fetch(`${baseUrl}/api/sessions/..%2F..%2Fetc%2Fpasswd`);
    expect(res.status).toBe(400);
  });

  test("GET artifact endpoint validates directory type and serves JSX preview", async () => {
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Preview API Session",
        providerId: "openai",
        modelId: "gpt-4o",
        styleId: "bauhaus",
        width: 800,
        height: 600,
      }),
    });
    const { session } = await createRes.json();

    // Invalid directory type
    const invalidTypeRes = await fetch(
      `${baseUrl}/api/sessions/${session.id}/artifacts/invalidtype/file.png`,
    );
    expect(invalidTypeRes.status).toBe(400);

    // Null byte in filename
    const nullByteRes = await fetch(
      `${baseUrl}/api/sessions/${session.id}/artifacts/images/file%00.png`,
    );
    expect(nullByteRes.status).toBe(400);

    // Save and fetch JSX artifact
    await sessionService.saveArtifact(
      session.id,
      "source",
      "design-001-v001.jsx",
      "export default function Test() { return <div>Test</div>; }",
    );

    const jsxRes = await fetch(
      `${baseUrl}/api/sessions/${session.id}/artifacts/source/design-001-v001.jsx`,
    );
    expect(jsxRes.status).toBe(200);
    expect(jsxRes.headers.get("Content-Type")).toContain("text/plain");
    const text = await jsxRes.text();
    expect(text).toContain("export default function Test");
  });
});
