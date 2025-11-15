// ------------------------------------------------------------
// /ws — WebSocket endpoint for real-time job updates
// ------------------------------------------------------------
// This route upgrades HTTP connections to WebSocket, allowing
// clients to subscribe to specific job IDs and receive live
// progress/status updates from Redis.
//
// Clients connect to:
//    wss://api.myspinbot.local/ws
//
// Message format examples:
//    → {"type": "subscribe", "jobId": "abcd123"}
//    ← {"type": "subscribed", "jobId": "abcd123"}
//    ← {"type": "update", "jobId": "abcd123", "status": "running", "progress": 42}
//
// Internally, the server polls or listens to Redis Pub/Sub
// events and pushes JSON messages over the WebSocket channel.
// ------------------------------------------------------------

import { getJobState } from "../controllers/queue.js";
import client from "prom-client";
import websocketPlugin from "@fastify/websocket";
import { register } from "./metrics.js";
import { WsAction, WsResponse } from "../model/enums.js";

function getOrCreateMetrics(name, type, opts) {
  return (
    register.getSingleMetric(name) ||
    new type({ name, ...opts, registers: [register] })
  );
}

const connected = getOrCreateMetrics(
  "websocket_clients_connected",
  client.Gauge,
  { help: "Current WS clients" }
);
const connections = getOrCreateMetrics(
  "websocket_connections_total",
  client.Counter,
  { help: "Total WS connects" }
);
const received = getOrCreateMetrics(
  "websocket_messages_received_total",
  client.Counter,
  { help: "WS messages in" }
);
const sent = getOrCreateMetrics(
  "websocket_messages_sent_total",
  client.Counter,
  { help: "WS messages out" }
);
const lifetime = getOrCreateMetrics(
  "websocket_client_lifetime_seconds",
  client.Histogram,
  { help: "Client session length" }
);
const wsErrors = getOrCreateMetrics("websocket_errors_total", client.Counter, {
  help: "Invalid WS operations",
});

export default async function wsRoute(fastify) {
  await fastify.register(websocketPlugin);

  fastify.get(
    "/ws",
    { websocket: true },
    (connection /* SocketStream */, req /* FastifyRequest */) => {
      const start = Date.now();
      connected.inc();
      connections.inc();
      fastify.log.info("WebSocket client connected");
      fastify.log.info({ event: "ws_connect", ip: req.ip });

      // Store active subscriptions per client
      const subscriptions = new Set();

      connection.socket.on("message", async (msg) => {
        received.inc();
        try {
          const data = JSON.parse(msg.toString());
          if (data.action === WsAction.SUBSCRIBE && data.jobId) {
            subscriptions.add(data.jobId);
            connection.socket.send(
              JSON.stringify({
                action: WsAction.RESPONSE,
                message: WsResponse.SUBSCRIBED,
                jobId: data.jobId,
              })
            );
          } else if (data.action === WsAction.UNSUBSCRIBE && data.jobId) {
            subscriptions.delete(data.jobId);
            connection.socket.send(
              JSON.stringify({
                action: WsAction.RESPONSE,
                message: WsResponse.UNSUBSCRIBED,
                jobId: data.jobId,
              })
            );
          }
        } catch (err) {
          wsErrors.inc();
          connection.socket.send(
            JSON.stringify({
              action: WsAction.RESPONSE,
              message: WsResponse.FAILED,
            })
          );
        }
      });

      // Periodically push job status to client
      const interval = setInterval(async () => {
        for (const jobId of subscriptions) {
          const status = await getJobState(jobId);
          sent.inc();
          connection.socket.send(JSON.stringify({ type: "update", ...status }));
        }
      }, 750);

      connection.socket.on("close", () => {
        connected.dec();
        clearInterval(interval);
        lifetime.observe((Date.now() - start) / 1000);
        fastify.log.info("WebSocket client disconnected");
      });
    }
  );
}
