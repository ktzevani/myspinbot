export default async function (fastify) {
  fastify.get('/health', async () => ({ status: 'ok' }));
}

