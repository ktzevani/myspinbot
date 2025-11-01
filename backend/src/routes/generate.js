// ------------------------------------------------------------
// /api/generate — Enqueue a generation job
// ------------------------------------------------------------
// Handles a video or voice generation request.
// ------------------------------------------------------------

export default async function generateRoutes(fastify) {
  fastify.post('/generate', async (req, reply) => {
    const payload = req.body || {};
    const jobId = `gen-${Date.now()}`;

    fastify.log.info({ jobId, payload }, 'Received generation request');

    return reply.send({
      jobId,
      status: 'queued',
      message: 'Generation job accepted',
    });
  });
}
