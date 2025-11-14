// ------------------------------------------------------------
// /api/generate — Enqueue a generation job
// ------------------------------------------------------------
// Handles a video or voice generation request.
// ------------------------------------------------------------

import { enqueueJob } from "../controllers/queue.js";
import { JobStatus } from "../lib/schemas.js";

export default async function generateRoutes(fastify) {
  fastify.post("/generate", async (_, reply) => {
    const jobId = await enqueueJob("render_video");
    fastify.log.info({ jobId }, "Generation job queued");
    return reply.send({
      jobId,
      status: JobStatus.QUEUED,
      progress: 0,
    });
  });
}
