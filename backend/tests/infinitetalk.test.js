import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { registerRoutes } from "../src/api/http/routes.js";
import { JobStatus } from "../src/model/defs.js";

describe("POST /api/infinitetalk", () => {
  let fastify;

  beforeAll(async () => {
    fastify = Fastify();
    await registerRoutes(fastify);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("enqueues a video generation (with Infinitetalk) job and returns a jobId", async () => {
    const res = await fastify.inject({
      method: "POST",
      url: "/api/infinitetalk",
      payload: {
        prompt:
          "You are taking the role of Carl Jung and you are giving a speech related to a random psychology issue. Speech need to be at least a page long.",
        refText:
          "Is quite alright as long as you know that you are not identical with the way in which you appear. But, if you are unconsious of this fact",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("jobId");
    expect(body.status).toBe(JobStatus.ADVERTISED);
  });
});
