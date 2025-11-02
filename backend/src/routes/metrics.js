import client from "prom-client";
export const register = new client.Registry();
client.collectDefaultMetrics({ register });
export default async function (fastify) {
  fastify.get("/metrics", async (_, reply) => {
    reply.header("Content-Type", register.contentType);
    return register.metrics();
  });
}
