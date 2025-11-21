import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import IORedis from "ioredis";
import { enqueueTrainJob, getJobState } from "../src/core/queue.js";
import { JobStatus, WsAction } from "../src/model/defs.js";
import { WebSocket } from "ws";
import { registerRoutes as registerHttpRoutes } from "../src/api/http/routes.js";
import { registerRoutes as registerWsRoutes } from "../src/api/ws/routes.js";

let fastify;
let port;
let redisPub;

beforeAll(async () => {
  fastify = Fastify({ logger: false });
  await registerHttpRoutes(fastify);
  await registerWsRoutes(fastify);
  await fastify.register(trainRoutes, { prefix: "/api" });
  const address = await fastify.listen({ port: 0 });
  port = new URL(address).port;
  redisPub = new IORedis(process.env.REDIS_URL || "redis://redis:6379");
});

afterAll(async () => {
  await fastify.close();
  await redisPub.quit();
});

describe("Queue integration", () => {
  it("Job Status: adds a job and retrieves status", async () => {
    const jobId = await enqueueTrainJob({ dataset: "unit-test" });
    const jobState = await getJobState(jobId);
    expect(jobState).toHaveProperty("status");
    expect(jobState).toHaveProperty("progress");
    expect(jobState.status).toBe(JobStatus.QUEUED);
    expect(jobState.progress).toBe(0);
  });

  it("Job Progress: creates a job and informs its status to subscribed clients", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/api/train",
      payload: { dataset: "queue-integration" },
    });
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body).toHaveProperty("jobId");
    expect(body.status).toBe(JobStatus.QUEUED);

    const jobId = body.jobId;
    const url = `ws://localhost:${port}/ws`;
    const ws = new WebSocket(url);

    const subscriptionPromise = new Promise((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ action: WsAction.SUBSCRIBE, jobId }));
      });
      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === "update") {
          ws.close();
          resolve(message);
        }
      });
      ws.on("error", (err) => reject(err));
    });

    const updateMessage = await subscriptionPromise;
    expect(updateMessage.jobId).toBe(jobId);
    expect(updateMessage.status).toBe(JobStatus.QUEUED);
    expect(updateMessage.progress).toBe(0);
  }, 15000);

  it("Job Lifecycle: status flow end-to-end", async () => {
    const jobId = await enqueueTrainJob({ dataset: "lifecycle" });

    await redisPub.publish(
      `status:${jobId}`,
      JSON.stringify({ jobId: jobId, status: JobStatus.RUNNING })
    );
    await redisPub.publish(
      `progress:${jobId}`,
      JSON.stringify({ jobId: jobId, progress: 0.5 })
    );
    await new Promise((r) => setTimeout(r, 150));

    let jobState = await getJobState(jobId);
    expect(jobState.status).toBe(JobStatus.RUNNING);
    expect(jobState.progress).toBeCloseTo(0.5, 2);

    await redisPub.publish(
      `status:${jobId}`,
      JSON.stringify({ jobId: jobId, status: JobStatus.COMPLETED })
    );
    await redisPub.publish(
      `progress:${jobId}`,
      JSON.stringify({ jobId: jobId, progress: 1 })
    );
    await new Promise((r) => setTimeout(r, 150));

    jobState = await getJobState(jobId);
    expect(jobState.status).toBe(JobStatus.COMPLETED);
    expect(jobState.progress).toBe(1);
  });

  it("Job Validation: inconsistent status/progress reported", async () => {
    const jobId = await enqueueTrainJob({ dataset: "invalid-combo" });

    // Worker emits impossible pair: status=running, progress=0
    await redisPub.publish(
      `status:${jobId}`,
      JSON.stringify({ jobId: jobId, status: JobStatus.RUNNING })
    );
    await redisPub.publish(
      `progress:${jobId}`,
      JSON.stringify({ jobId: jobId, progress: 0 })
    );
    await new Promise((r) => setTimeout(r, 150));

    const jobState = await getJobState(jobId);
    expect(jobState.status).toBe("something_went_wrong");
    expect(jobState.progress).toBe(-1);
  });

  it("Job Validation: invalid numeric input handled gracefully", async () => {
    const jobId = await enqueueTrainJob({ dataset: "invalid-numeric" });

    // Worker emits NaN progress
    await redisPub.publish(
      `status:${jobId}`,
      JSON.stringify({ jobId: jobId, status: JobStatus.RUNNING })
    );
    await redisPub.publish(
      `progress:${jobId}`,
      JSON.stringify({ jobId: jobId, progress: NaN })
    );
    await new Promise((r) => setTimeout(r, 150));

    const jobState = await getJobState(jobId);
    expect(jobState.status).toBe("something_went_wrong");
    expect(jobState.progress).toBe(-1);
  });
});
