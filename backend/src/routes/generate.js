// ------------------------------------------------------------
// /api/generate — Enqueue a generation job
// ------------------------------------------------------------
// Handles a video or voice generation request.
// ------------------------------------------------------------

import { enqueueGenerateJob } from '../controllers/queue.js';

export default async function generateRoutes(fastify) {
  fastify.post('/generate', async (req, reply) => {
    const payload = req.body || {};
    const jobId = await enqueueGenerateJob(payload);
    fastify.log.info({ jobId }, 'Generation job queued');
    return reply.send({
      jobId,
      status: 'queued',
    });
  });
}
