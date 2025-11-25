import { getOrCreateMetric, MetricType } from "./metrics.js";
import { WsAction, WsResponse, WsMessageType } from "../model/defs.js";
import { getConfiguration } from "../config.js";

class WsServer {
  constructor(configuration = getConfiguration()) {
    this.connected = getOrCreateMetric(
      "websocket_clients_connected",
      MetricType.GAUGE,
      { help: "Current WS clients" }
    );
    this.connections = getOrCreateMetric(
      "websocket_connections_total",
      MetricType.COUNTER,
      { help: "Total WS connects" }
    );
    this.received = getOrCreateMetric(
      "websocket_messages_received_total",
      MetricType.COUNTER,
      { help: "WS messages in" }
    );
    this.sent = getOrCreateMetric(
      "websocket_messages_sent_total",
      MetricType.COUNTER,
      {
        help: "WS messages out",
      }
    );
    this.lifetime = getOrCreateMetric(
      "websocket_client_lifetime_seconds",
      MetricType.HISTOGRAM,
      { help: "Client session length" }
    );
    this.wsErrors = getOrCreateMetric(
      "websocket_errors_total",
      MetricType.COUNTER,
      {
        help: "Invalid WS operations",
      }
    );
    this.handlers = [];
    this.updatesIntervalMs = configuration.websocket.updateInterval;
  }
  async registerJobMessageHandler(handler) {
    this.handlers.push(handler);
  }
  async endpoint(req, _res) {
    const start = Date.now();
    this.connected.inc();
    this.connections.inc();

    // Store active subscriptions per client
    const subscriptions = new Set();

    req.socket.on("message", async (msg) => {
      this.received.inc();
      try {
        const data = JSON.parse(msg.toString());
        if (data.action === WsAction.SUBSCRIBE && data.jobId) {
          subscriptions.add(data.jobId);
          req.socket.send(
            JSON.stringify({
              action: WsAction.RESPONSE,
              message: WsResponse.SUBSCRIBED,
              jobId: data.jobId,
            })
          );
        } else if (data.action === WsAction.UNSUBSCRIBE && data.jobId) {
          subscriptions.delete(data.jobId);
          req.socket.send(
            JSON.stringify({
              action: WsAction.RESPONSE,
              message: WsResponse.UNSUBSCRIBED,
              jobId: data.jobId,
            })
          );
        }
      } catch (err) {
        this.wsErrors.inc();
        req.socket.send(
          JSON.stringify({
            action: WsAction.RESPONSE,
            message: WsResponse.FAILED,
          })
        );
      }
    });

    // Periodically push job messages to client

    let stopped = false;
    let pollTimer;

    const poll = async () => {
      if (stopped) return;
      try {
        const updates = await Promise.all(
          [...subscriptions].map(async (jobId) => {
            const parts = await Promise.all(
              this.handlers.map((fn) => fn(jobId))
            );
            return parts.reduce((acc, part) => Object.assign(acc, part), {
              jobId,
            });
          })
        );
        for (const update of updates) {
          this.sent.inc();
          if (req.socket.readyState === req.socket.OPEN) {
            req.socket.send(
              JSON.stringify({ type: WsMessageType.UPDATE, ...update })
            );
          }
        }
      } catch (err) {
        // optionally log/metrics here
      } finally {
        if (!stopped) pollTimer = setTimeout(poll, this.updatesIntervalMs);
      }
    };

    pollTimer = setTimeout(poll, this.updatesIntervalMs);

    req.socket.on("close", () => {
      stopped = true;
      clearTimeout(pollTimer);
      this.connected.dec();
      this.lifetime.observe((Date.now() - start) / 1000);
    });
  }
}

function factory() {
  const server = new WsServer();
  return server;
}

export const wsServer = factory();
export default wsServer;
