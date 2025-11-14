// ------------------------------------------------------------
// Redis Streams controller
// ------------------------------------------------------------
//
// Exposed functions:
//   - enqueueTrainJob(data)      -> returns jobId
//   - enqueueGenerateJob(data)   -> returns jobId
//   - getJobStatus(jobId)        -> { id, status, progress } | { status: "not_found" }
//   - closeQueues()              -> gracefully close Redis clients
//
// Runtime conventions (mirrors your Phase 2 plan):
//   • Enqueue -> XADD to jobs:<name> with fields: jid, type, timestamp, data(JSON)
//   • Status  -> HSET job:<jid> { status, progress, type, enqueued_at, ... }
//   • Events  -> PUBLISH status:<jid> "queued|running|completed|failed"
//                PUBLISH progress:<jid> "<0..1|−1>"
//   • Workers are expected to update both Pub/Sub and job hash keys.
//
// Accepted status values:
//   🟢 "queued"     — job pending; progress = 0
//   🟡 "running"    — job executing; progress ∈ (0,1)
//   🟣 "completed"  — job finished; progress = 1
//   🔴 "failed"     — job failed irrecoverably; progress = −1
//
// Any deviation from these conventions will cause validation to yield
// `{ status: "something_went_wrong", progress: -1 }`.
//
// Notes:
//   • Job ids (jid) are generated via crypto.randomUUID().
//   • Backend persists events and relays to UI via WebSockets.
// ------------------------------------------------------------

import IORedis from "ioredis";
import { randomUUID } from "node:crypto";
import { JobStatus } from "../lib/schemas.js";

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";

const JOBS = {
  get_capabilities: "jobs:info",
  train_lora: "jobs:process",
};

const JOB_KEY_TTL_SECONDS = parseInt(
  process.env.JOB_KEY_TTL_SECONDS || "604800",
  10
);

let redisDBClient = null;
let redisSubscriber = null;
let subscribed = false;

// ============================================================
// Redis Helpers
// ============================================================

const jobMsgKey = (channel, jobId) => `job:${jobId}:${channel}`;

function getRedis(create = true) {
  if (!redisDBClient && create) {
    redisDBClient = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
    console.log(`[Streams] Connected to ${REDIS_URL}`);
  }
  return redisDBClient;
}

function getSubscriber(create = true) {
  if (!redisSubscriber && create) {
    redisSubscriber = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
    redisSubscriber.on("pmessage", async (_pattern, message, payload) => {
      try {
        let [channel, jobId] = message.split(":");
        await persistChannelData(channel, jobId, JSON.parse(payload)[channel]);
      } catch (error) {
        console.error(
          "[Streams] Event persistence error:",
          error?.message || error
        );
      }
    });
  }
  return redisSubscriber;
}

async function ensureEventLogging() {
  if (subscribed) return;
  const subscriber = getSubscriber();
  if (!subscriber) return;
  await subscriber.psubscribe("status:*");
  await subscriber.psubscribe("progress:*");
  await subscriber.psubscribe("data:*");
  subscribed = true;
  console.log("[Streams] Subscribed to pub/sub channels");
}

// ============================================================
// Persistence
// ============================================================

async function persistChannelData(channel, jobId, data) {
  const dbClient = getRedis();
  if (!dbClient) return;
  const pipeline = dbClient.pipeline();
  pipeline.set(jobMsgKey(channel, jobId), data);
  pipeline.expire(jobMsgKey(channel, jobId), JOB_KEY_TTL_SECONDS);
  await pipeline.exec();
}

// ============================================================
// Core Enqueue Logic
// ============================================================

export async function enqueueJob(name, input) {
  const dbClient = getRedis();
  await ensureEventLogging();

  const streamName = JOBS[name];
  if (!streamName) throw new Error(`Unknown job: ${name}`);

  const jobId = randomUUID();
  const created = Date.now().toString();
  const inputPayload = JSON.stringify(input ?? {});

  await dbClient.xadd(
    streamName,
    "*",
    "jobId",
    jobId,
    "name",
    name,
    "created",
    created,
    "input",
    inputPayload
  );

  const jobKey = `job:${jobId}`;
  const pipeline = dbClient.pipeline();

  pipeline.hset(jobKey, {
    name: name,
    input: inputPayload,
    created: created,
  });
  pipeline.set(jobMsgKey("status", jobId), JobStatus.QUEUED);
  pipeline.set(jobMsgKey("progress", jobId), JobStatus.QUEUED);
  pipeline.expire(jobKey, JOB_KEY_TTL_SECONDS);
  pipeline.expire(jobMsgKey("status", jobId), JOB_KEY_TTL_SECONDS);
  pipeline.expire(jobMsgKey("progress", jobId), JOB_KEY_TTL_SECONDS);

  await pipeline.exec();
  return jobId;
}

// ============================================================
// Public API
// ============================================================

export async function getJobState(jobId) {
  if (!jobId) return { status: JobStatus.NOT_FOUND };

  const dbClient = getRedis(false);
  if (!dbClient) return { status: JobStatus.NOT_FOUND };

  let currentStatus = await dbClient.get(jobMsgKey("status", jobId));
  let currentProgress = await dbClient.get(jobMsgKey("progress", jobId));

  return { jobId: jobId, status: currentStatus, progress: currentProgress };
}

export async function getJobResult(jobId) {
  let jobQueryInterval;
  const jobPromise = new Promise((resolve, reject) => {
    jobQueryInterval = setInterval(async () => {
      const ljob = await getJobState(jobId);
      if (ljob.status === JobStatus.NOT_FOUND) {
        clearInterval(jobQueryInterval);
        reject("Job not found");
      } else if (ljob.status == JobStatus.COMPLETED) {
        clearInterval(jobQueryInterval);
        resolve(ljob);
      }
    }, 250);
  });
  let result;
  let job;
  try {
    job = await jobPromise;
  } catch (rejected) {
    result = rejected;
  }
  if (job.status != JobStatus.NOT_FOUND) {
    const dbClient = getRedis(false);
    if (!dbClient) return { status: "Critical error." };
    result = await dbClient.get(jobMsgKey("data", jobId));
  }
  return JSON.parse(result);
}

export async function closeQueues() {
  try {
    if (redisSubscriber) {
      try {
        if (subscribed) {
          await redisSubscriber.punsubscribe("status:*");
          await redisSubscriber.punsubscribe("progress:*");
          await redisSubscriber.punsubscribe("data:*");
        }
      } catch {}
      await redisSubscriber.quit();
    }
  } catch {}
  try {
    if (redisDBClient) {
      await redisDBClient.quit();
    }
  } catch {}
  redisSubscriber = null;
  redisDBClient = null;
  subscribed = false;
  console.log("[Streams] Connections closed");
}

export default {
  enqueueJob,
  getJobState,
  getJobResult,
  closeQueues,
};
