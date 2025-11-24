import jobQueue from "../../core/job-queue.js";
import client from "prom-client";
import { register } from "../http/metrics-controller.js";
import { WsAction, WsResponse } from "../../model/defs.js";

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

export default async function wsServer(connection, req) {
  const start = Date.now();
  connected.inc();
  connections.inc();

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
      const status = await jobQueue.getJobState(jobId);
      sent.inc();
      connection.socket.send(JSON.stringify({ type: "update", ...status }));
    }
  }, 750);

  connection.socket.on("close", () => {
    connected.dec();
    clearInterval(interval);
    lifetime.observe((Date.now() - start) / 1000);
  });
}
