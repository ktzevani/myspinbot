// ------------------------------------------------------------
// /api/status/:id — Check job status
// ------------------------------------------------------------

import { getJobStatus } from "../controllers/queue.js";

export default async function statusRoutes(fastify) {
  fastify.get("/status/:id", async (req, reply) => {
    const { id } = req.params;
    const result = await getJobStatus(id);
    return reply.send({
      jobId: id,
      status: result.status,
      progress: result.progress,
    });
  });
}
