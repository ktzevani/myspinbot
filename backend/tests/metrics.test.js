import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { registerRoutes } from "../src/api/http/routes.js";

describe("GET /metrics", () => {
  let fastify;

  beforeAll(async () => {
    fastify = Fastify();
    await registerRoutes(fastify);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("returns Prometheus metrics text", async () => {
    const res = await fastify.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain("# HELP");
  });
});
