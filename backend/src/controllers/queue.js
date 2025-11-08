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
import { JobStatus } from "../lib/enums.js";

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";

const STREAMS = {
  train: "jobs:train",
  generate: "jobs:generate",
};

const JOB_KEY_TTL_SECONDS = parseInt(
  process.env.JOB_KEY_TTL_SECONDS || "604800",
  10
);

let redisDBClient = null;
let redisSubscriber = null;
let subscribed = false;

// ============================================================
// Redis Key & Channel Helpers
// ============================================================

const jobHashKey = (jobId) => `job:${jobId}`;
const jobStatusKey = (jobId) => `job:${jobId}:status`;
const jobProgressKey = (jobId) => `job:${jobId}:progress`;

// ============================================================
// Redis Connection Helpers
// ============================================================

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
    redisSubscriber.on("pmessage", async (_pattern, channel, message) => {
      try {
        if (channel.startsWith("status:")) {
          const jobId = channel.slice("status:".length);
          await persistStatus(jobId, JSON.parse(message.toString())?.status);
          logStatus(jobId, message);
          return;
        }
        if (channel.startsWith("progress:")) {
          const jobId = channel.slice("progress:".length);
          await persistProgress(
            jobId,
            JSON.parse(message.toString())?.progress
          );
          return;
        }
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
  subscribed = true;
  console.log("[Streams] Subscribed to status:* and progress:*");
}

// ============================================================
// Persistence
// ============================================================

async function persistStatus(jobId, rawStatus) {
  const dbClient = getRedis();
  const status = String(rawStatus || "").toLowerCase();
  const jobKey = jobHashKey(jobId);
  const pipeline = dbClient.pipeline();
  pipeline.hset(jobKey, { id: jobId, status });
  pipeline.set(jobStatusKey(jobId), status);
  pipeline.expire(jobKey, JOB_KEY_TTL_SECONDS);
  pipeline.expire(jobStatusKey(jobId), JOB_KEY_TTL_SECONDS);
  await pipeline.exec();
}

async function persistProgress(jobId, rawProgress) {
  const dbClient = getRedis();
  const progressValue = String(rawProgress ?? "0").trim();
  const jobKey = jobHashKey(jobId);
  const pipeline = dbClient.pipeline();
  pipeline.hset(jobKey, { id: jobId, progress: progressValue });
  pipeline.set(jobProgressKey(jobId), progressValue);
  pipeline.expire(jobKey, JOB_KEY_TTL_SECONDS);
  pipeline.expire(jobProgressKey(jobId), JOB_KEY_TTL_SECONDS);
  await pipeline.exec();
}

function logStatus(jobId, status) {
  if (status === JobStatus.COMPLETED) {
    console.log(`[Streams] ✅ Job ${jobId} completed`);
  } else if (status === JobStatus.FAILED) {
    console.error(`[Streams] ❌ Job ${jobId} failed`);
  } else if (status === JobStatus.RUNNING) {
    console.log(`[Streams] ▶️  Job ${jobId} running`);
  } else if (status === JobStatus.QUEUED) {
    console.log(`[Streams] ⏳ Job ${jobId} queued`);
  } else {
    console.log(`[Streams] ℹ️  Job ${jobId} status: ${status}`);
  }
}

// ============================================================
// Status Validation
// ============================================================

function validateJobState(status, progress) {
  const normalizedStatus = (status || "").toLowerCase();
  const numericProgress = Number(progress);
  const isProgressValid = Number.isFinite(numericProgress);

  if (!isProgressValid) {
    return { status: "something_went_wrong", progress: -1 };
  }

  switch (normalizedStatus) {
    case JobStatus.QUEUED:
      return numericProgress === 0
        ? { status: normalizedStatus, progress: numericProgress }
        : { status: "something_went_wrong", progress: -1 };
    case JobStatus.RUNNING:
      return numericProgress > 0 &&
        (numericProgress < 1 || numericProgress === 1)
        ? { status: normalizedStatus, progress: numericProgress }
        : { status: "something_went_wrong", progress: -1 };
    case JobStatus.COMPLETED:
      return numericProgress === 1
        ? { status: normalizedStatus, progress: numericProgress }
        : { status: "something_went_wrong", progress: -1 };
    case JobStatus.FAILED:
      return numericProgress === -1
        ? { status: normalizedStatus, progress: numericProgress }
        : { status: "something_went_wrong", progress: -1 };
    default:
      return { status: "something_went_wrong", progress: -1 };
  }
}

// ============================================================
// Core Enqueue Logic
// ============================================================

async function enqueueJob(kind, data) {
  const dbClient = getRedis();
  await ensureEventLogging();

  const streamName = STREAMS[kind];
  if (!streamName) throw new Error(`Unknown job kind: ${kind}`);

  const jobId = randomUUID();
  const timestamp = Date.now().toString();
  const serializedPayload = JSON.stringify(data ?? {});

  await dbClient.xadd(
    streamName,
    "*",
    "jid",
    jobId,
    "type",
    // TODO: Just for aiding manual integration testing (will change)
    kind + "_lora",
    "timestamp",
    timestamp,
    "data",
    serializedPayload
  );

  const jobKey = jobHashKey(jobId);
  const pipeline = dbClient.pipeline();
  pipeline.hset(jobKey, {
    id: jobId,
    type: kind,
    status: JobStatus.QUEUED,
    progress: "0",
    enqueued_at: timestamp,
  });
  pipeline.expire(jobKey, JOB_KEY_TTL_SECONDS);
  pipeline.expire(jobStatusKey(jobId), JOB_KEY_TTL_SECONDS);
  pipeline.expire(jobProgressKey(jobId), JOB_KEY_TTL_SECONDS);
  await pipeline.exec();

  return jobId;
}

// ============================================================
// Public API
// ============================================================

export async function enqueueTrainJob(data) {
  return enqueueJob("train", data);
}

export async function enqueueGenerateJob(data) {
  return enqueueJob("generate", data);
}

export async function getJobStatus(jobId) {
  if (!jobId) return { status: JobStatus.NOT_FOUND };

  const dbClient = getRedis(false);
  if (!dbClient) return { status: JobStatus.NOT_FOUND };

  const jobKey = jobHashKey(jobId);
  const jobData = await dbClient.hgetall(jobKey);

  const normalizeStatus = (raw) =>
    typeof raw === "string" ? raw.toLowerCase() : "unknown";
  const parseProgress = (raw) => {
    const numericValue = Number(raw);
    return Number.isFinite(numericValue) ? numericValue : NaN;
  };

  let currentStatus;
  let currentProgress;

  if (jobData && Object.keys(jobData).length > 0) {
    currentStatus = normalizeStatus(jobData.status ?? "unknown");
    currentProgress = parseProgress(jobData.progress);
  } else {
    const pipeline = dbClient.pipeline();
    pipeline.get(jobStatusKey(jobId));
    pipeline.get(jobProgressKey(jobId));
    const [[, storedStatus], [, storedProgress]] = await pipeline.exec();

    if (!storedStatus && !storedProgress)
      return { status: JobStatus.NOT_FOUND };
    currentStatus = normalizeStatus(storedStatus ?? "unknown");
    currentProgress = parseProgress(storedProgress);
  }

  return { jobId: jobId, ...validateJobState(currentStatus, currentProgress) };
}

export async function closeQueues() {
  try {
    if (redisSubscriber) {
      try {
        if (subscribed) {
          await redisSubscriber.punsubscribe("status:*");
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
  enqueueTrainJob,
  enqueueGenerateJob,
  getJobStatus,
  closeQueues,
};
