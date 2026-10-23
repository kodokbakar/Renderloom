import { afterAll, describe, expect, test } from "bun:test";
import { createServer } from "../../src/server/server";

describe("Local Bun HTTP API", () => {
  const server = createServer(0);

  afterAll(() => {
    server.stop();
  });

  test("GET /api/health returns 200 OK without credentials", async () => {
    const res = await fetch(`http://localhost:${server.port}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.name).toBe("renderloom");
  });

  test("POST /api/validate-generation validates request body", async () => {
    const res = await fetch(
      `http://localhost:${server.port}/api/validate-generation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "test",
          prompt: "test",
          styleId: "bauhaus",
          candidateCount: 2,
          width: 800,
          height: 600,
          outputFormat: "png",
          providerId: "openai",
          modelId: "gpt-4o",
        }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
  });

  test("POST /api/validate-generation returns 400 for invalid body", async () => {
    const res = await fetch(
      `http://localhost:${server.port}/api/validate-generation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "",
        }),
      },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.error).toBeDefined();
  });

  test("returns 404 for unknown route", async () => {
    const res = await fetch(`http://localhost:${server.port}/unknown`);
    expect(res.status).toBe(404);
  });
});
