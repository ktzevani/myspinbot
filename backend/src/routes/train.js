// ------------------------------------------------------------
// /api/train — Enqueue a training job
// ------------------------------------------------------------
// This endpoint interacts with BullMQ to add a job to the 
// 'train' queue and responsds with the generated job ID.
// ------------------------------------------------------------

import { enqueueTrainJob } from "../controllers/queue.js";

export default async function trainRoutes(fastify) {
  fastify.post('/train', async (req, reply) => {
    const payload = req.body || {};
    const jobId = await enqueueTrainJob(payload);
    fastify.log.info({ jobId }, 'Training job queued');
    return reply.send({
      jobId,
      status: 'queued',
    });
  });
}
