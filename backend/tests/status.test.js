import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { registerRoutes } from "../src/api/http/routes.js";
import { submitTrainJob } from "../src/api/http/jobController.js";

describe("GET /api/status/:id", () => {
  let fastify;
  let jobId;

  beforeAll(async () => {
    fastify = Fastify();
    await registerRoutes(fastify);
    await fastify.ready();
    jobId = (await submitTrainJob()).jobId;
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
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("progress");
  });
});
