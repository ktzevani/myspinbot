// ------------------------------------------------------------
// /api/train — Enqueue a training job
// ------------------------------------------------------------
// This endpoint introduces a job to the 'train' job queue and
// responsds with the generated job ID.
// ------------------------------------------------------------

import { enqueueJob } from "../controllers/queue.js";
import { JobStatus } from "../lib/schemas.js";

export default async function trainRoutes(fastify) {
  fastify.post("/train", async (_, reply) => {
    const jobId = await enqueueJob("train_lora");
    fastify.log.info({ jobId }, "Training job queued");
    return reply.send({
      jobId,
      status: JobStatus.QUEUED,
      progress: 0,
    });
  });
}
