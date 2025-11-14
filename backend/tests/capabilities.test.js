import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify from "fastify";
import capabilitiesRoute from "../src/routes/capabilities.js";
import {
  listNodeCapabilities,
  closeWorkerCapabilitiesBridge,
} from "../src/capabilities/registry.js";
import IORedis from "ioredis";

let fastify;
let redis;
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const WORKER_CAPABILITIES_JOB_STREAM =
  process.env.WORKER_CAPABILITIES_JOB_STREAM || "jobs:python";
const WORKER_CAPABILITIES_CHANNEL =
  process.env.WORKER_CAPABILITIES_CHANNEL || "worker_capabilities";

beforeAll(async () => {
  fastify = Fastify({ logger: false });
  await fastify.register(capabilitiesRoute);
  await fastify.ready();
  redis = new IORedis(REDIS_URL);
});

afterAll(async () => {
  await fastify.close();
  if (redis) {
    await redis.quit();
  }
  await closeWorkerCapabilitiesBridge();
});

beforeEach(async () => {
  if (redis) {
    await redis.del(WORKER_CAPABILITIES_JOB_STREAM);
  }
});

async function respondOnceWithCapabilities(capabilities = []) {
  const worker = new IORedis(REDIS_URL);
  try {
    const response = await worker.xread(
      "BLOCK",
      5000,
      "STREAMS",
      WORKER_CAPABILITIES_JOB_STREAM,
      "0-0"
    );
    const entries = response?.[0]?.[1];
    if (!Array.isArray(entries) || entries.length === 0) {
      return;
    }
    const [, fields] = entries[0];
    const record = {};
    for (let i = 0; i < fields.length; i += 2) {
      record[fields[i]] = fields[i + 1];
    }
    let requestId = record.jid;
    if (record.data) {
      try {
        const parsed = JSON.parse(record.data);
        requestId = parsed.requestId || requestId;
      } catch {}
    }
    await worker.publish(
      WORKER_CAPABILITIES_CHANNEL,
      JSON.stringify({
        requestId,
        manifest: {
          generatedAt: new Date().toISOString(),
          plane: "python",
          capabilities,
        },
      })
    );
  } finally {
    await worker.quit();
  }
}

describe("GET /capabilities", () => {
  it("returns node-plane capability manifest when worker replies empty list", async () => {
    const workerPromise = respondOnceWithCapabilities([]);
    const response = await fastify.inject({
      method: "GET",
      url: "/capabilities",
    });
    await workerPromise;
    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload).toHaveProperty("plane", "node");
    expect(Array.isArray(payload.capabilities)).toBe(true);
    expect(payload.capabilities.length).toBe(listNodeCapabilities().length);
    expect(payload.capabilities[0]).toHaveProperty("id");
    expect(payload.capabilities[0]).toHaveProperty("handler");
    expect(payload).toHaveProperty("sources");
    expect(payload.sources).toMatchObject({
      node: listNodeCapabilities().length,
      python: 0,
    });
  });

  it("merges python worker advertised capabilities", async () => {
    const workerCapability = {
      id: "python.train_lora",
      label: "Train LoRA",
      description: "GPU LoRA fine-tuning task",
      plane: "python",
      runtime: { kind: "gpu", timeoutSeconds: 3600, concurrency: 1 },
      handler: { module: "worker/tasks/train_lora.py", method: "run" },
      io: {
        input: { type: "object", properties: { dataset: { type: "string" } } },
        output: { type: "object", properties: { artifactId: { type: "string" } } },
      },
    };
    const workerPromise = respondOnceWithCapabilities([workerCapability]);

    const response = await fastify.inject({
      method: "GET",
      url: "/capabilities",
    });
    await workerPromise;

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);

    expect(payload.capabilities.length).toBe(
      listNodeCapabilities().length + 1
    );
    expect(payload.sources).toMatchObject({
      node: listNodeCapabilities().length,
      python: 1,
    });
    expect(
      payload.capabilities.some((cap) => cap.id === workerCapability.id)
    ).toBe(true);
  });
});
