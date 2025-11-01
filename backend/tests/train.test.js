import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import trainRoutes from "../src/routes/train.js";

describe("POST /api/train", () => {
  let fastify;

  beforeAll(async () => {
    fastify = Fastify();
    await fastify.register(trainRoutes, { prefix: "/api" });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("enqueues a train job and returns a jobId", async () => {
    const res = await fastify.inject({
      method: "POST",
      url: "/api/train",
      payload: { dataset: "demo" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("jobId");
    expect(body.status).toBe("queued");
  });
});
