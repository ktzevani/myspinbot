import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import supertest from "supertest";
import multipart from "@fastify/multipart";
import { registerRoutes } from "../src/api/http/routes.js";
import { JobStatus } from "../src/model/defs.js";
import path from "path";

describe("POST /api/infinitetalk", () => {
  let fastify;

  beforeAll(async () => {
    fastify = Fastify();
    await fastify.register(multipart, {
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    });
    await registerRoutes(fastify);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("enqueues a video generation (with Infinitetalk) job and returns a jobId", async () => {
    const imagePath = path.resolve(
      process.cwd(),
      "shared/resources/carl_jung.jpg"
    );
    const audioPath = path.resolve(
      process.cwd(),
      "shared/resources/carl_jung.wav"
    );

    const res = await supertest(fastify.server)
      .post("/api/infinitetalk")
      .field(
        "prompt",
        "You are taking the role of Carl Jung and you are giving a speech related to a random psychology issue. Speech need to be at least a page long."
      )
      .field(
        "refText",
        "Is quite alright as long as you know that you are not identical with the way in which you appear. But, if you are unconsious of this fact"
      )
      .attach("image", imagePath)
      .attach("audio", audioPath);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("jobId");
    expect(res.body.status).toBe(JobStatus.ADVERTISED);
  });
});
