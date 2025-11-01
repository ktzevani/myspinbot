// ------------------------------------------------------------
// /api/status/:id — Check job status
// ------------------------------------------------------------

export default async function statusRoutes(fastify) {
  fastify.get('/status/:id', async (req, reply) => {
    const { id } = req.params;

    // Placeholder values
    const mockState = 'pending';
    const mockProgress = 0;

    fastify.log.debug({ id }, 'Status requested');

    return reply.send({
      jobId: id,
      state: mockState,
      progress: mockProgress,
      message: 'Job is pending',
    });
  });
}
