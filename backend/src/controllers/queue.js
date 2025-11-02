// ------------------------------------------------------------
// BullMQ controller
// ------------------------------------------------------------
// Handles Redis connection, queue creation, and helper methods
// for adding and inspecting jobs.
// ------------------------------------------------------------

import { Queue, QueueEvents, Job } from "bullmq";
import IORedis from "ioredis";

// Connection
let redisConnection = null;
// Two queues with event loggers — one for training, one for generation
let trainQueue = null;
let generateQueue = null;
let trainEvents = null;
let generateEvents = null;

/**
 * Lazily construct a shared Redis connection for BullMQ.
 */
function getConnection(createConnection = true) {
  if (createConnection && !redisConnection) {
    const url = process.env.REDIS_URL || "redis://redis:6379";
    redisConnection = new IORedis(url, {
      maxRetriesPerRequest: null,
    });
    console.log(`[BullMQ] Connected to ${url}`);
  }
  return redisConnection;
}

function getTrainQueue(createConnection = true) {
  const connection = getConnection(createConnection);
  if (!trainQueue && connection) {
    trainQueue = new Queue("train", { connection });
    trainEvents = new QueueEvents("train", { connection });
    trainEvents.on("completed", ({ jobId }) =>
      console.log(`[BullMQ] ✅ Train job ${jobId} completed`)
    );
    trainEvents.on("failed", ({ jobId, failedReason }) =>
      console.error(`[BullMQ] ❌ Train job ${jobId} failed: ${failedReason}`)
    );
  }
  return trainQueue;
}

function getGenerateQueue(createConnection = true) {
  const connection = getConnection(createConnection);
  if (!generateQueue && connection) {
    generateQueue = new Queue("generate", { connection });
    generateEvents = new QueueEvents("generate", { connection });
    generateEvents.on("completed", ({ jobId }) =>
      console.log(`[BullMQ] ✅ Generate job ${jobId} completed`)
    );
    generateEvents.on("failed", ({ jobId, failedReason }) =>
      console.error(`[BullMQ] ❌ Generate job ${jobId} failed: ${failedReason}`)
    );
  }
  return generateQueue;
}

// ------------------------------------------------------------
// Exported helper functions
// ------------------------------------------------------------

export async function enqueueTrainJob(data) {
  const job = await getTrainQueue().add("train", data);
  return job.id;
}

export async function enqueueGenerateJob(data) {
  const job = await getGenerateQueue().add("generate", data);
  return job.id;
}

export async function getJobStatus(jobId) {
  // Try both queues to find the job
  let queue = getTrainQueue(false);
  let job = null;
  if (queue) {
    job = await Job.fromId(queue, jobId);
  }
  if (!job) {
    queue = getGenerateQueue(false);
    if (queue) {
      job = await Job.fromId(queue, jobId);
    }
  }
  if (!job) {
    return { state: "not_found" };
  }
  const state = await job.getState();
  const progress = job.progress || 0;
  return { id: job.id, state, progress };
}

export async function closeQueues() {
  await Promise.all([
    trainQueue?.close(),
    generateQueue?.close(),
    trainEvents?.close(),
    generateEvents?.close(),
    redisConnection?.quit(),
  ]);
  trainQueue =
    generateQueue =
    trainEvents =
    generateEvents =
    redisConnection =
      null;
  console.log("[BullMQ] Queues closed");
}

export default {
  enqueueTrainJob,
  enqueueGenerateJob,
  getJobStatus,
  closeQueues,
};
