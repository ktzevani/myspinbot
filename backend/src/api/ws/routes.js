import websocketPlugin from "@fastify/websocket";
import wsServer from "./websocketServer.js";

async function wsRoute(fastify) {
  await fastify.register(websocketPlugin);
  fastify.get("/ws", { websocket: true }, wsServer);
}

export async function registerRoutes(app) {
  await app.register(wsRoute);
}