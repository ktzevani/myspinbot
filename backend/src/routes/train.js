// ------------------------------------------------------------
// /api/train — Enqueue a training job
// ------------------------------------------------------------
// This endpoint introduces a job to the 'train' job queue and
// responsds with the generated job ID.
// ------------------------------------------------------------

import { enqueueTrainJob } from "../controllers/queue.js";

export default async function trainRoutes(fastify) {
  fastify.post("/train", async (req, reply) => {
    const payload = req.body || {};
    const jobId = await enqueueTrainJob(payload);
    fastify.log.info({ jobId }, "Training job queued");
    return reply.send({
      jobId,
      status: "queued",
      progress: 0,
    });
  });
}
