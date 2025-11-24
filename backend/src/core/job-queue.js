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
//           - freeResources()
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

const createQueueError = (configuration) =>
  Object.freeze({
    JOB_NOT_FOUND: (jobId) => {
      return { error: `Job (${jobId}) not found.` };
    },
    REDIS_CONNECTION_UNAVAILABLE: {
      error: `No connection to (${configuration.bridge.url})`,
    },
  });

export class JobQueue {
  constructor(configuration = getConfiguration()) {
    this.configuration = configuration;
    this.redisURL = configuration.bridge.url;
    this.jobKeyTTL = configuration.bridge.jobs.ttl;
    this.job2Stream = {
      [configuration.bridge.jobs.available.GET_CAPABILITIES]:
        `${configuration.bridge.streams.info}:data`,
      [configuration.bridge.jobs.available.PROCESS_GRAPH]:
        `${configuration.bridge.streams.process}:data`,
    };
    this.queueError = createQueueError(configuration);
    this.redisDBClient = null;
    this.redisSubscriber = null;
  }

  getRedis(create = true) {
    if (!this.redisDBClient && create) {
      this.redisDBClient = new IORedis(this.redisURL, {
        maxRetriesPerRequest: null,
      });
    }
    return this.redisDBClient;
  }

  async ensurePubSubLine() {
    if (!this.redisSubscriber) {
      try {
        this.redisSubscriber = new IORedis(this.redisURL, {
          maxRetriesPerRequest: null,
        });
        this.redisSubscriber.on(
          "pmessage",
          async (_pattern, message, payload) => {
            try {
              let [_, property, jobId] = message.split(":");
              await this.persistMessage(
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
      } catch (e) {
        await Promise.all(
          Object.values(this.configuration.bridge.channels).map((pattern) =>
            this.redisSubscriber.punsubscribe(pattern + ":*")
          )
        );
        await this.redisSubscriber.quit();
        this.redisSubscriber = null;
      }
    }
  }

  async persistMessage(jobId, property, value) {
    const dbClient = this.getRedis();
    if (dbClient) {
      const pipeline = dbClient.pipeline();
      pipeline.set(jobDbKey(jobId, property), value);
      pipeline.expire(jobDbKey(jobId, property), this.jobKeyTTL);
      await pipeline.exec();
    }
  }

  async enqueueJob(name, input) {
    const dbClient = this.getRedis();
    if (!dbClient) throw this.queueError.REDIS_CONNECTION_UNAVAILABLE;
    await this.ensurePubSubLine();
    const streamName = this.job2Stream[name];
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
    pipeline.expire(jobDbKey(jobId), this.jobKeyTTL);
    pipeline.expire(jobDbKey(jobId, JobProperty.STATUS), this.jobKeyTTL);
    pipeline.expire(jobDbKey(jobId, JobProperty.PROGRESS), this.jobKeyTTL);
    await pipeline.exec();

    return jobId;
  }

  async getJobState(jobId) {
    if (!jobId) throw this.queueError.JOB_NOT_FOUND(jobId);
    const dbClient = this.getRedis(false);
    if (!dbClient) throw this.queueError.REDIS_CONNECTION_UNAVAILABLE;

    let currentStatus = await dbClient.get(jobDbKey(jobId, JobProperty.STATUS));
    let currentProgress = await dbClient.get(
      jobDbKey(jobId, JobProperty.PROGRESS)
    );

    return {
      jobId: jobId,
      status: currentStatus,
      progress: Number(currentProgress),
    };
  }

  async getJobResult(jobId) {
    let jobQueryInterval;
    await new Promise((resolve, reject) => {
      jobQueryInterval = setInterval(async () => {
        const state = await this.getJobState(jobId);
        if (state == this.queueError.JOB_NOT_FOUND(jobId)) {
          clearInterval(jobQueryInterval);
          reject(state);
        } else if (state?.status == JobStatus.COMPLETED) {
          clearInterval(jobQueryInterval);
          resolve(state);
        }
      }, 250);
    });
    const dbClient = this.getRedis(false);
    if (!dbClient) throw this.queueError.REDIS_CONNECTION_UNAVAILABLE;
    return dbClient.get(jobDbKey(jobId, JobProperty.DATA));
  }

  async freeResources() {
    if (this.redisSubscriber) {
      await Promise.all(
        Object.values(this.configuration.bridge.channels).map((pattern) =>
          this.redisSubscriber.punsubscribe(pattern)
        )
      );
      await this.redisSubscriber.quit();
      this.redisSubscriber = null;
    }
    if (this.redisDBClient) {
      await this.redisDBClient.quit();
      this.redisDBClient = null;
    }
  }
}

export const jobQueue = new JobQueue();
export default jobQueue;
