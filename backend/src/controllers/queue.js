// ------------------------------------------------------------
// BullMQ controller
// ------------------------------------------------------------
// Handles Redis connection, queue creation, and helper methods
// for adding and inspecting jobs.
// ------------------------------------------------------------

import { Queue, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection
const connection = new IORedis(process.env.REDIS_URL || 'redis://redis:6379', 
  {
    maxRetriesPerRequest: null,
  });

// Two queues with event loggers — one for training, one for generation
const trainQueue = new Queue('train', { connection });
const generateQueue = new Queue('generate', { connection });
const trainEvents = new QueueEvents('train', { connection });
const generateEvents = new QueueEvents('generate', { connection });

trainEvents.on('completed', ({ jobId }) =>
  console.log(`[BullMQ] ✅ Train job ${jobId} completed`)
);
trainEvents.on('failed', ({ jobId, failedReason }) =>
  console.error(`[BullMQ] ❌ Train job ${jobId} failed: ${failedReason}`)
);

generateEvents.on('completed', ({ jobId }) =>
  console.log(`[BullMQ] ✅ Generate job ${jobId} completed`)
);
generateEvents.on('failed', ({ jobId, failedReason }) =>
  console.error(`[BullMQ] ❌ Generate job ${jobId} failed: ${failedReason}`)
);

// ------------------------------------------------------------
// Exported helper functions
// ------------------------------------------------------------

export async function enqueueTrainJob(data) {
  const job = await trainQueue.add('train', data);
  return job.id;
}

export async function enqueueGenerateJob(data) {
  const job = await generateQueue.add('generate', data);
  return job.id;
}

export async function getJobStatus(jobId) {
  // Try both queues to find the job
  let job = await Job.fromId(trainQueue, jobId);
  if (!job) job = await Job.fromId(generateQueue, jobId);
  if (!job) return { state: 'not_found' };

  const state = await job.getState();
  const progress = job.progress || 0;
  return { id: job.id, state, progress };
}

export default { enqueueTrainJob, enqueueGenerateJob, getJobStatus };
