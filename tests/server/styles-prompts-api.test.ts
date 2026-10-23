import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { createServer } from "../../src/server/server";

describe("Styles, Dimensions, and Prompts API", () => {
  let server: Server<unknown>;
  let baseUrl: string;

  beforeAll(() => {
    // Port 0 selects an available ephemeral port
    server = createServer({ port: 0 });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server.stop();
  });

  describe("GET /api/styles", () => {
    test("returns all built-in styles with summary metadata", async () => {
      const res = await fetch(`${baseUrl}/api/styles`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data.styles)).toBe(true);
      expect(data.styles.length).toBe(5);

      const bauhaus = data.styles.find(
        (s: { id: string }) => s.id === "bauhaus",
      );
      expect(bauhaus).toBeDefined();
      expect(bauhaus.name).toBe("Bauhaus");
      expect(bauhaus.palette).toBeDefined();
      expect(bauhaus.visualSample).toBeDefined();
    });
  });

  describe("GET /api/styles/:id", () => {
    test("returns full style preset for valid ID", async () => {
      const res = await fetch(`${baseUrl}/api/styles/swiss`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.style.id).toBe("swiss");
      expect(data.style.name).toBe("Swiss International");
      expect(data.style.designPrinciples.length).toBeGreaterThan(0);
      expect(data.style.typography.guidelines.length).toBeGreaterThan(0);
      expect(data.style.layout.rules.length).toBeGreaterThan(0);
      expect(data.style.allowedEffects.length).toBeGreaterThan(0);
      expect(data.style.patternsToAvoid.length).toBeGreaterThan(0);
    });

    test("returns 404 for unknown style ID", async () => {
      const res = await fetch(`${baseUrl}/api/styles/nonexistent-style-id`);
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.code).toBe("STYLE_NOT_FOUND");
    });
  });

  describe("POST /api/dimensions/resolve", () => {
    test("resolves standard aspect ratio preset 16:9", async () => {
      const res = await fetch(`${baseUrl}/api/dimensions/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aspectRatio: "16:9" }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.dimensions).toEqual({
        width: 1280,
        height: 720,
        aspectRatio: "16:9",
      });
    });

    test("resolves custom dimensions", async () => {
      const res = await fetch(`${baseUrl}/api/dimensions/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ width: 800, height: 600 }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.dimensions).toEqual({
        width: 800,
        height: 600,
        aspectRatio: "custom",
      });
    });

    test("rejects dimensions exceeding pixel bounds (4 Megapixels)", async () => {
      const res = await fetch(`${baseUrl}/api/dimensions/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ width: 3000, height: 3000 }),
      });
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toContain("cannot exceed 4194304");
    });

    test("rejects malformed json", async () => {
      const res = await fetch(`${baseUrl}/api/dimensions/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/prompts/default", () => {
    test("returns base system prompt content", async () => {
      const res = await fetch(`${baseUrl}/api/prompts/default`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(typeof data.prompt).toBe("string");
      expect(data.prompt).toContain("You are an expert graphic designer");
    });
  });

  describe("POST /api/prompts/compose", () => {
    test("composes valid system and user prompt with metadata", async () => {
      const res = await fetch(`${baseUrl}/api/prompts/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Editorial magazine cover for a literary journal",
          styleId: "editorial",
          candidateCount: 3,
          aspectRatio: "4:5",
        }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.composed).toBeDefined();
      expect(data.composed.metadata.styleId).toBe("editorial");
      expect(data.composed.metadata.candidateCount).toBe(3);
      expect(data.composed.metadata.dimensions).toEqual({
        width: 1024,
        height: 1280,
        aspectRatio: "4:5",
      });
      expect(data.composed.systemPrompt).toContain(
        "IMMUTABLE TECHNICAL CONSTRAINTS",
      );
      expect(data.composed.systemPrompt).toContain(
        "### Style Preset: Editorial",
      );
      expect(data.composed.systemPrompt).toContain(
        "Provide exactly 3 candidate objects",
      );
      expect(data.composed.userPrompt).toContain(
        "Editorial magazine cover for a literary journal",
      );
    });

    test("returns 404 when composing with unknown style ID", async () => {
      const res = await fetch(`${baseUrl}/api/prompts/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "A poster",
          styleId: "cyberpunk-unknown",
        }),
      });
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.code).toBe("STYLE_NOT_FOUND");
    });

    test("returns 400 when candidateCount exceeds maximum of 4", async () => {
      const res = await fetch(`${baseUrl}/api/prompts/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "A poster",
          styleId: "bauhaus",
          candidateCount: 8,
        }),
      });
      expect(res.status).toBe(400);
    });

    test("returns 400 when prompt exceeds 4000 characters", async () => {
      const res = await fetch(`${baseUrl}/api/prompts/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "x".repeat(4005),
          styleId: "bauhaus",
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/validate-generation with Style & Bounds Checking", () => {
    test("accepts request with known style and bounded resources", async () => {
      const res = await fetch(`${baseUrl}/api/validate-generation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "sess-1",
          prompt: "A poster",
          styleId: "bauhaus",
          candidateCount: 2,
          width: 1024,
          height: 1024,
          outputFormat: "png",
          providerId: "openai",
          modelId: "gpt-4o",
        }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.valid).toBe(true);
    });

    test("rejects request with unknown styleId", async () => {
      const res = await fetch(`${baseUrl}/api/validate-generation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "sess-1",
          prompt: "A poster",
          styleId: "unknown-style",
          candidateCount: 1,
          width: 1024,
          height: 1024,
          outputFormat: "png",
          providerId: "openai",
          modelId: "gpt-4o",
        }),
      });
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.valid).toBe(false);
      expect(data.error).toContain("Unknown styleId");
    });

    test("rejects request with candidateCount > 4", async () => {
      const res = await fetch(`${baseUrl}/api/validate-generation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "sess-1",
          prompt: "A poster",
          styleId: "bauhaus",
          candidateCount: 6,
          width: 1024,
          height: 1024,
          outputFormat: "png",
          providerId: "openai",
          modelId: "gpt-4o",
        }),
      });
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.valid).toBe(false);
    });

    test("rejects request when dimensions exceed 4,194,304 max pixels", async () => {
      const res = await fetch(`${baseUrl}/api/validate-generation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "sess-1",
          prompt: "A poster",
          styleId: "bauhaus",
          candidateCount: 1,
          width: 4096,
          height: 1025, // 4,198,400 > 4,194,304
          outputFormat: "png",
          providerId: "openai",
          modelId: "gpt-4o",
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.valid).toBe(false);
    });
  });

  describe("API Resource Bounds & Validation Edge Cases", () => {
    test("POST /api/dimensions/resolve accepts exact 4,194,304 pixel boundary and rejects 4,194,305+", async () => {
      // Exactly max pixels
      const validRes = await fetch(`${baseUrl}/api/dimensions/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ width: 4096, height: 1024 }),
      });
      expect(validRes.status).toBe(200);
      const validData = await validRes.json();
      expect(validData.dimensions).toEqual({
        width: 4096,
        height: 1024,
        aspectRatio: "custom",
      });

      // 1 pixel over boundary
      const invalidRes = await fetch(`${baseUrl}/api/dimensions/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ width: 4096, height: 1025 }),
      });
      expect(invalidRes.status).toBe(400);
    });

    test("POST /api/prompts/compose accepts exact 4000 char prompt and rejects 4001 chars", async () => {
      // Exact 4000 chars
      const validRes = await fetch(`${baseUrl}/api/prompts/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "a".repeat(4000),
          styleId: "minimal",
        }),
      });
      expect(validRes.status).toBe(200);

      // 4001 chars
      const invalidRes = await fetch(`${baseUrl}/api/prompts/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "a".repeat(4001),
          styleId: "minimal",
        }),
      });
      expect(invalidRes.status).toBe(400);
    });

    test("POST /api/prompts/compose validates candidateCount bounds (1 to 4)", async () => {
      // Lower boundary: 1
      const res1 = await fetch(`${baseUrl}/api/prompts/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Test candidate 1",
          styleId: "swiss",
          candidateCount: 1,
        }),
      });
      expect(res1.status).toBe(200);

      // Upper boundary: 4
      const res4 = await fetch(`${baseUrl}/api/prompts/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Test candidate 4",
          styleId: "swiss",
          candidateCount: 4,
        }),
      });
      expect(res4.status).toBe(200);

      // Below lower boundary: 0
      const res0 = await fetch(`${baseUrl}/api/prompts/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Test candidate 0",
          styleId: "swiss",
          candidateCount: 0,
        }),
      });
      expect(res0.status).toBe(400);

      // Above upper boundary: 5
      const res5 = await fetch(`${baseUrl}/api/prompts/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Test candidate 5",
          styleId: "swiss",
          candidateCount: 5,
        }),
      });
      expect(res5.status).toBe(400);
    });

    test("GET /api/styles/:id safely rejects traversal or invalid characters", async () => {
      const res = await fetch(`${baseUrl}/api/styles/..%2F..%2Fpackage.json`);
      // URL path decoder normalizes to 404 or regex rejects with 404
      expect([400, 404]).toContain(res.status);
    });
  });
});
