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
function getConnection() {
  if (!redisConnection) {
    const url = process.env.REDIS_URL || "redis://redis:6379";
    redisConnection = new IORedis(url, {
      maxRetriesPerRequest: null,
    });
    console.log(`[BullMQ] Connected to ${url}`);
  }
  return redisConnection;
}

// ------------------------------------------------------------
// Exported helper functions
// ------------------------------------------------------------

export async function enqueueTrainJob(data) {
  if (!trainQueue) {
    const connection = getConnection();
    trainQueue = new Queue("train", { connection });
    trainEvents = new QueueEvents("train", { connection });
    trainEvents.on("completed", ({ jobId }) =>
      console.log(`[BullMQ] ✅ Train job ${jobId} completed`)
    );
    trainEvents.on("failed", ({ jobId, failedReason }) =>
      console.error(`[BullMQ] ❌ Train job ${jobId} failed: ${failedReason}`)
    );
  }
  const job = await trainQueue.add("train", data);
  return job.id;
}

export async function enqueueGenerateJob(data) {
  if (!generateQueue) {
    const connection = getConnection();
    generateQueue = new Queue("generate", { connection });
    generateEvents = new QueueEvents("generate", { connection });
    generateEvents.on("completed", ({ jobId }) =>
      console.log(`[BullMQ] ✅ Generate job ${jobId} completed`)
    );
    generateEvents.on("failed", ({ jobId, failedReason }) =>
      console.error(`[BullMQ] ❌ Generate job ${jobId} failed: ${failedReason}`)
    );
  }
  const job = await generateQueue.add("generate", data);
  return job.id;
}

export async function getJobStatus(jobId) {
  // Try both queues to find the job
  let job = await Job.fromId(trainQueue, jobId);
  if (!job) job = await Job.fromId(generateQueue, jobId);
  if (!job) return { state: "not_found" };

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
