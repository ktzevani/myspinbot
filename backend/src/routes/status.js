// ------------------------------------------------------------
// /api/status/:id — Check job status
// ------------------------------------------------------------

import { getJobState } from "../controllers/queue.js";

export default async function statusRoutes(fastify) {
  fastify.get("/status/:id", async (req, reply) => {
    const { id } = req.params;
    const result = await getJobState(id);
    return reply.send({
      jobId: id,
      status: result.status,
      progress: result.progress,
    });
  });
}
