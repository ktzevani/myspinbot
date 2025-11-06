import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import IORedis from "ioredis";
import {
  enqueueTrainJob,
  getJobStatus,
  JOB_STATUS,
} from "../src/controllers/queue.js";
import { WebSocket } from "ws";
import wsRoute from "../src/routes/ws.js";
import trainRoutes from "../src/routes/train.js";

let fastify;
let port;
let redisPub;

beforeAll(async () => {
  fastify = Fastify({ logger: false });
  await fastify.register(wsRoute);
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
    const status = await getJobStatus(jobId);
    expect(status).toHaveProperty("status");
    expect(status).toHaveProperty("progress");
    expect(status.status).toBe(JOB_STATUS.QUEUED);
    expect(status.progress).toBe(0);
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
    expect(body.status).toBe(JOB_STATUS.QUEUED);

    const jobId = body.jobId;
    const url = `ws://localhost:${port}/ws`;
    const ws = new WebSocket(url);

    const subscriptionPromise = new Promise((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "subscribe", jobId }));
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
    expect(updateMessage.id).toBe(jobId);
    expect(updateMessage.status).toBe(JOB_STATUS.QUEUED);
    expect(updateMessage.progress).toBe(0);
  }, 15000);

  it("Job Lifecycle: status flow end-to-end", async () => {
    const jobId = await enqueueTrainJob({ dataset: "lifecycle" });

    await redisPub.publish(`status:${jobId}`, "running");
    await redisPub.publish(`progress:${jobId}`, "0.5");
    await new Promise((r) => setTimeout(r, 150));

    let jobStatus = await getJobStatus(jobId);
    expect(jobStatus.status).toBe(JOB_STATUS.RUNNING);
    expect(jobStatus.progress).toBeCloseTo(0.5, 2);

    await redisPub.publish(`status:${jobId}`, "completed");
    await redisPub.publish(`progress:${jobId}`, "1");
    await new Promise((r) => setTimeout(r, 150));

    jobStatus = await getJobStatus(jobId);
    expect(jobStatus.status).toBe(JOB_STATUS.COMPLETED);
    expect(jobStatus.progress).toBe(1);
  });

  it("Job Validation: inconsistent status/progress reported", async () => {
    const jobId = await enqueueTrainJob({ dataset: "invalid-combo" });

    // Worker emits impossible pair: status=running, progress=1
    await redisPub.publish(`status:${jobId}`, "running");
    await redisPub.publish(`progress:${jobId}`, "1");
    await new Promise((r) => setTimeout(r, 150));

    const jobStatus = await getJobStatus(jobId);
    expect(jobStatus.status).toBe("something_went_wrong");
    expect(jobStatus.progress).toBe(-1);
  });

  it("Job Validation: invalid numeric input handled gracefully", async () => {
    const jobId = await enqueueTrainJob({ dataset: "invalid-numeric" });

    // Worker emits NaN progress
    await redisPub.publish(`status:${jobId}`, "running");
    await redisPub.publish(`progress:${jobId}`, "not_a_number");
    await new Promise((r) => setTimeout(r, 150));

    const jobStatus = await getJobStatus(jobId);
    expect(jobStatus.status).toBe("something_went_wrong");
    expect(jobStatus.progress).toBe(-1);
  });
});
