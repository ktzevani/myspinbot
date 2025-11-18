// -----------------------------------------------------------------------------
// Redis Job Queue Controller
// -----------------------------------------------------------------------------
//
// This module provides a unified interface for:
//   ✔ Enqueuing jobs into Redis Streams
//   ✔ Tracking job status & progress via Redis keys
//   ✔ Subscribing to worker-emitted Pub/Sub updates
//   ✔ Persisting real-time status/progress updates into Redis
//   ✔ Querying job state and waiting for job completion
//   ✔ Gracefully shutting down Redis connections
//
// -----------------------------------------------------------------------------
// 🔧 Redis Architecture & Data Model
// -----------------------------------------------------------------------------
//
// Workers consume tasks from Redis Streams using XREADGROUP.
//
// 1. **Job Enqueue (Backend → Workers)**
//    XADD <streamName> *
//         jobId      <uuid>
//         name       <jobName>
//         created    <timestamp>
//         input      <serializedInput>
//
//    Stream name is resolved via Job2Stream mapping.
//
// 2. **Job State Persistence**
//    The backend maintains the current job state in lightweight Redis keys:
//
//    job:<jobId>                  → HSET { name, input, created }
//    job:<jobId>:status           → "advertised" | "queued" | "running" | "completed" | "failed"
//    job:<jobId>:progress         → number (0–1) or -1
//    job:<jobId>:data             → optional worker-produced result payload
//
//    All keys receive an expiration (TTL) as configured.
//
// 3. **Worker → Backend Pub/Sub Updates**
//    Workers publish events using:
//      PUBLISH channel:status:<jobId>   "{ status: <enum> }"
//      PUBLISH channel:progress:<jobId> "{ progress: <number> }"
//      PUBLISH channel:data:<jobId>     "{ data: <json> }"
//
//    The backend subscribes to:
//      channel:status:*
//      channel:progress:*
//      channel:data:*
//
//    On each event, the backend persists the update into the job:* keys.
//
// -----------------------------------------------------------------------------
// 🔍 Exposed API
// -----------------------------------------------------------------------------
//
//   • enqueueJob(name, input)
//         Adds job to correct Redis stream, initializes job state, returns jobId.
//
//   • getJobState(jobId)
//         Retrieves current status + progress from Redis.
//
//   • getJobResult(jobId)
//         Polls until the job reaches COMPLETED, then resolves with the job result.
//
//   • closeQueues()
//         Gracefully shuts down Redis DB and subscriber clients.
//
// -----------------------------------------------------------------------------
// 🚦 Supported Status Values (JobStatus enum)
//
//     advertised   – job has been added to the stream
//     queued       – worker acknowledged job
//     running      – job is executing
//     completed    – job finished successfully
//     failed       – job ended with error
//
// Workers are responsible for transitioning job state from advertised → queued → …
//
// -----------------------------------------------------------------------------
// ⚠ Notes
//
//   • A dedicated subscriber connection handles Pub/Sub.
//   • A separate redis client handles Streams + storage.
//   • Both connections persist data using pipelines.
//   • Errors such as connection loss do not crash the process;
//     they simply cause job persistence to skip until reconnect.
//
// -----------------------------------------------------------------------------

import IORedis from "ioredis";
import { randomUUID } from "node:crypto";
import { JobStatus } from "../model/enums.js";
import { getConfiguration } from "../config.js";

const AppConfiguration = getConfiguration();

export const QueueError = Object.freeze({
  JOB_NOT_FOUND: (jobId) => {
    return { error: `Job (${jobId}) not found.` };
  },
  REDIS_CONNECTION_UNAVAILABLE: {
    error: `No connection to (${AppConfiguration.bridge.url})`,
  },
});

const Job2Stream = {
  [AppConfiguration.bridge.jobs.available.GET_CAPABILITIES]:
    AppConfiguration.bridge.streams.info,
  [AppConfiguration.bridge.jobs.available.PROCESS_GRAPH]:
    AppConfiguration.bridge.streams.process,
};

const JobProperty = Object.freeze({
  STATUS: "status",
  PROGRESS: "progress",
  DATA: "data",
});

const redisURL = AppConfiguration.bridge.url;
const jobKeyTTL = AppConfiguration.bridge.jobs.ttl;
const jobDbKey = (jobId, subKey) =>
  subKey ? `job:${jobId}:${subKey}` : `job:${jobId}`;

let redisDBClient = null;
let redisSubscriber = null;

function getRedis(create = true) {
  if (!redisDBClient && create) {
    redisDBClient = new IORedis(redisURL, {
      maxRetriesPerRequest: null,
    });
  }
  return redisDBClient;
}

async function ensurePubSubLine() {
  if (!redisSubscriber) {
    try {
      redisSubscriber = new IORedis(redisURL, {
        maxRetriesPerRequest: null,
      });
      redisSubscriber.on("pmessage", async (_pattern, message, payload) => {
        try {
          let [_, property, jobId] = message.split(":");
          await persistMessage(jobId, property, JSON.parse(payload)[property]);
        } catch (error) {
          console.error(
            "[Streams] Event persistence error:",
            error?.message || error
          );
        }
      });
      await Promise.all(
        Object.values(AppConfiguration.bridge.channels).map((pattern) =>
          redisSubscriber.psubscribe(pattern + ':*')
        )
      );
    } catch (e) {
      await Promise.all(
        Object.values(AppConfiguration.bridge.channels).map((pattern) =>
          redisSubscriber.punsubscribe(pattern + ':*')
        )
      );
      await redisSubscriber.quit();
      redisSubscriber = null;
    }
  }
}

async function persistMessage(jobId, property, value) {
  const dbClient = getRedis();
  if (dbClient) {
    const pipeline = dbClient.pipeline();
    pipeline.set(jobDbKey(jobId, property), value);
    pipeline.expire(jobDbKey(jobId, property), jobKeyTTL);
    await pipeline.exec();
  }
}

export async function enqueueJob(name, input) {
  const dbClient = getRedis();
  if (!dbClient) throw QueueError.REDIS_CONNECTION_UNAVAILABLE;
  await ensurePubSubLine();
  const streamName = Job2Stream[name];
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

  const pipeline = dbClient.pipeline();

  pipeline.hset(jobDbKey(jobId), {
    name: name,
    input: inputPayload,
    created: created,
  });
  pipeline.set(jobDbKey(jobId, JobProperty.STATUS), JobStatus.ADVERTISED);
  pipeline.set(jobDbKey(jobId, JobProperty.PROGRESS), 0);
  pipeline.expire(jobDbKey(jobId), jobKeyTTL);
  pipeline.expire(jobDbKey(jobId, JobProperty.STATUS), jobKeyTTL);
  pipeline.expire(jobDbKey(jobId, JobProperty.PROGRESS), jobKeyTTL);
  await pipeline.exec();

  return jobId;
}

export async function getJobState(jobId) {
  if (!jobId) throw QueueError.JOB_NOT_FOUND(jobId);
  const dbClient = getRedis(false);
  if (!dbClient) throw QueueError.REDIS_CONNECTION_UNAVAILABLE;

  let currentStatus = await dbClient.get(jobDbKey(jobId, JobProperty.STATUS));
  let currentProgress = await dbClient.get(
    jobDbKey(jobId, JobProperty.PROGRESS)
  );

  return { jobId: jobId, status: currentStatus, progress: currentProgress };
}

export async function getJobResult(jobId) {
  let jobQueryInterval;
  await new Promise((resolve, reject) => {
    jobQueryInterval = setInterval(async () => {
      const state = await getJobState(jobId);
      if (state == QueueError.JOB_NOT_FOUND(jobId)) {
        clearInterval(jobQueryInterval);
        reject(state);
      } else if (state?.status == JobStatus.COMPLETED) {
        clearInterval(jobQueryInterval);
        resolve(state);
      }
    }, 250);
  });
  const dbClient = getRedis(false);
  if (!dbClient) throw QueueError.REDIS_CONNECTION_UNAVAILABLE;
  return dbClient.get(jobDbKey(jobId, JobProperty.DATA));
}

export async function closeQueues() {
  if (redisSubscriber) {
    await Promise.all(
      Object.values(AppConfiguration.bridge.channels).map((pattern) =>
        redisSubscriber.punsubscribe(pattern)
      )
    );
    await redisSubscriber.quit();
    redisSubscriber = null;
  }
  if (redisDBClient) {
    await redisDBClient.quit();
    redisDBClient = null;
  }
}

export default {
  enqueueJob,
  getJobState,
  getJobResult,
  closeQueues,
};
