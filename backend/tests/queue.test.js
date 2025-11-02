import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { enqueueTrainJob, getJobStatus } from "../src/controllers/queue.js";
import { WebSocket } from "ws";
import wsRoute from "../src/routes/ws.js";
import trainRoutes from "../src/routes/train.js";

let fastify;
let port;

beforeAll(async () => {
  fastify = Fastify({ logger: false });
  await fastify.register(wsRoute);
  await fastify.register(trainRoutes, { prefix: "/api" });
  const address = await fastify.listen({ port: 0 }); // random free port
  port = new URL(address).port;
});

afterAll(async () => {
  await fastify.close();
});

describe("Queue integration", () => {
  it("Job Status: adds a job and retrieves status", async () => {
    const id = await enqueueTrainJob({ dataset: "unit-test" });
    const status = await getJobStatus(id);
    expect(status).toHaveProperty("state");
  });

  it("Job Progress: creates a job and informs its status to subscribed clients", async () => {
    const res = await fastify.inject({
      method: "POST",
      url: "/api/train",
      payload: { dataset: "queue-integration" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("jobId");
    expect(body.status).toBe("queued");
    const jobId = body.jobId;
    const url = `ws://localhost:${port}/ws`;
    const ws = new WebSocket(url);
    const subscriptionPromise = new Promise((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "subscribe", jobId: jobId }));
      });
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "update") {
          ws.close();
          resolve(msg);
        }
      });
      ws.on("error", (err) => reject(err));
    });
    const progressObj = await subscriptionPromise;
    expect(progressObj).toHaveProperty("id");
    expect(progressObj).toHaveProperty("state");
    expect(progressObj).toHaveProperty("progress");
    expect(progressObj.id).toBe(jobId);
    expect(progressObj.state).toBe("waiting");
  }, 15000);
});
