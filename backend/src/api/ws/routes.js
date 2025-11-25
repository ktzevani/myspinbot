import websocketPlugin from "@fastify/websocket";
import { getConnection } from "./ws-controller.js";

async function wsRoute(fastify) {
  await fastify.register(websocketPlugin);
  fastify.get("/ws", { websocket: true }, async (req, reply) => {
    return getConnection(req, reply);
  });
}

export async function registerRoutes(app) {
  await app.register(wsRoute);
}
