import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import statusRoutes from "../src/routes/status.js";
import { enqueueTrainJob } from "../src/controllers/queue.js";

describe("GET /api/status/:id", () => {
  let fastify;
  let jobId;

  beforeAll(async () => {
    fastify = Fastify();
    await fastify.register(statusRoutes, { prefix: "/api" });
    await fastify.ready();
    jobId = await enqueueTrainJob({ dataset: "demo" });
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("returns job state and progress", async () => {
    const res = await fastify.inject({
      method: "GET",
      url: `/api/status/${jobId}`,
    });
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("state");
    expect(body).toHaveProperty("progress");
  });
});
