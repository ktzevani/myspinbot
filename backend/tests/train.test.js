import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { registerRoutes } from "../src/api/http/routes.js";
import { JobStatus } from "../src/model/defs.js";

describe("POST /api/train", () => {
  let fastify;

  beforeAll(async () => {
    fastify = Fastify();
    await registerRoutes(fastify);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("enqueues a train job and returns a jobId", async () => {
    const res = await fastify.inject({
      method: "POST",
      url: "/api/train",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("jobId");
    expect(body.status).toBe(JobStatus.ADVERTISED);
  });
});
