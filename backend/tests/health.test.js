import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import registerRoutes from "../src/api/http/routes.js";

describe("GET /health", () => {
  let fastify;

  beforeAll(async () => {
    fastify = Fastify();
    await registerRoutes(fastify);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("responds with status ok", async () => {
    const res = await fastify.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: "ok" });
  });
});
