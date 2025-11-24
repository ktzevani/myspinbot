// -----------------------------------------------------------------------------
// Backend Job Queue
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
//   • JobQueue
//         Class encapsulating Redis connections + operations.
//         Methods:
//           - enqueueJob(name, input)
//           - getJobState(jobId)
//           - getJobResult(jobId)
//           - init()
//           - stop()
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
import { JobStatus } from "../model/defs.js";
import { getConfiguration } from "./config.js";

const JobProperty = Object.freeze({
  STATUS: "status",
  PROGRESS: "progress",
  DATA: "data",
});

const jobDbKey = (jobId, subKey) =>
  subKey ? `job:${jobId}:${subKey}` : `job:${jobId}`;

const queueError = Object.freeze({
  JOB_NOT_FOUND: (jobId) => {
    return `Job (${jobId}) not found.`;
  },
  JOB_TYPE_UNKNOWN: (jobName) => {
    return `Unknown job (${jobName}).`;
  },
  JOB_QUEUE_INVALID_ARGS: (argName) => {
    return `Invalid or missing argument ${argName}.`;
  },
  JOB_QUEUE_UNINITIALIZED: "Job queue needs initialization, run init() first.",
});

export class JobQueueError extends Error {
  constructor(msg) {
    super(msg);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class JobQueue {
  constructor(configuration = getConfiguration()) {
    this.configuration = configuration;
    this.jobKeyTTL = configuration.bridge.jobs.ttl;
    this.job2Stream = {
      [configuration.bridge.jobs.available.GET_CAPABILITIES]:
        `${configuration.bridge.streams.info}:data`,
      [configuration.bridge.jobs.available.PROCESS_GRAPH]:
        `${configuration.bridge.streams.process}:data`,
    };
    this.ready = false;
    process.on("SIGTERM", () => this.stop());
    process.on("SIGINT", () => this.stop());
  }

  async #persistMessage(jobId, property, value) {
    if (this.ready) {
      const pipeline = this.redisDBClient.pipeline();
      pipeline.set(jobDbKey(jobId, property), value);
      pipeline.expire(jobDbKey(jobId, property), this.jobKeyTTL);
      await pipeline.exec();
    }
  }

  async init() {
    if (!this.ready) {
      this.redisDBClient = new IORedis(this.configuration.bridge.url, {
        maxRetriesPerRequest: null,
      });
      this.redisSubscriber = new IORedis(this.configuration.bridge.url, {
        maxRetriesPerRequest: null,
      });
      this.redisSubscriber.on(
        "pmessage",
        async (_pattern, message, payload) => {
          try {
            let [_, property, jobId] = message.split(":");
            await this.#persistMessage(
              jobId,
              property,
              JSON.parse(payload)[property]
            );
          } catch (error) {
            console.error(
              "[Streams] Event persistence error:",
              error?.message || error
            );
          }
        }
      );
      await Promise.all(
        Object.values(this.configuration.bridge.channels).map((pattern) =>
          this.redisSubscriber.psubscribe(pattern + ":*")
        )
      );
      this.ready = true;
    }
  }

  async stop() {
    if (this.ready) {
      await Promise.all(
        Object.values(this.configuration.bridge.channels).map((pattern) =>
          this.redisSubscriber.punsubscribe(pattern)
        )
      );
      await this.redisSubscriber.quit();
      await this.redisDBClient.quit();
      this.redisSubscriber = null;
      this.redisDBClient = null;
      this.ready = false;
    }
  }

  async enqueueJob(name, input) {
    if (!this.ready)
      throw new JobQueueError(queueError.JOB_QUEUE_UNINITIALIZED);

    const streamName = this.job2Stream[name];
    if (!streamName)
      throw new JobQueueError(queueError.JOB_QUEUE_UNINITIALIZED(name));

    const jobId = randomUUID();
    const created = Date.now().toString();
    const inputPayload = JSON.stringify(input ?? {});

    await this.redisDBClient.xadd(
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

    const pipeline = this.redisDBClient.pipeline();

    pipeline.hset(jobDbKey(jobId), {
      name: name,
      input: inputPayload,
      created: created,
    });
    pipeline.set(jobDbKey(jobId, JobProperty.STATUS), JobStatus.ADVERTISED);
    pipeline.set(jobDbKey(jobId, JobProperty.PROGRESS), 0);
    pipeline.expire(jobDbKey(jobId), this.jobKeyTTL);
    pipeline.expire(jobDbKey(jobId, JobProperty.STATUS), this.jobKeyTTL);
    pipeline.expire(jobDbKey(jobId, JobProperty.PROGRESS), this.jobKeyTTL);
    await pipeline.exec();

    return jobId;
  }

  async getJobState(jobId) {
    if (!this.ready)
      throw new JobQueueError(queueError.JOB_QUEUE_UNINITIALIZED);
    if (!jobId)
      throw new JobQueueError(queueError.JOB_QUEUE_INVALID_ARGS("jobId"));

    let currentStatus = await this.redisDBClient.get(
      jobDbKey(jobId, JobProperty.STATUS)
    );
    let currentProgress = await this.redisDBClient.get(
      jobDbKey(jobId, JobProperty.PROGRESS)
    );

    if (currentStatus == null || currentProgress == null) {
      throw new JobQueueError(queueError.JOB_NOT_FOUND(jobId));
    }

    return {
      jobId: jobId,
      status: currentStatus,
      progress: Number(currentProgress),
    };
  }

  async getJobResult(jobId) {
    if (!this.ready)
      throw new JobQueueError(queueError.JOB_QUEUE_UNINITIALIZED);
    await new Promise((resolve, reject) => {
      const stop = () => clearInterval(jobQueryInterval);
      const jobQueryInterval = setInterval(() => {
        this.getJobState(jobId)
          .then((state) => {
            if (state?.status == JobStatus.COMPLETED) {
              stop();
              resolve(state);
            }
          })
          .catch((err) => {
            stop();
            reject(err);
          });
      }, 250);
    });
    return this.redisDBClient.get(jobDbKey(jobId, JobProperty.DATA));
  }
}

export const jobQueue = new JobQueue();
await jobQueue.init();
export default jobQueue;
