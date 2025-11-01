// ------------------------------------------------------------
// /api/train — Enqueue a training job
// ------------------------------------------------------------
// This endpoint interacts with BullMQ to add a job to the 
// 'train' queue and responsds with the generated job ID.
// ------------------------------------------------------------

export default async function trainRoutes(fastify) {
  fastify.post('/train', async (req, reply) => {
    // Example of extracting JSON body data
    const payload = req.body || {};
    // Generate a mock job ID — later BullMQ will generate this
    const jobId = `train-${Date.now()}`;
    // Log the request (Fastify has a built-in logger)
    fastify.log.info({ jobId, payload }, 'Received training request');

    // Respond with a standard JSON object
    return reply.send({
      jobId,
      status: 'queued',
      message: 'Training job accepted',
    });
  });
}
