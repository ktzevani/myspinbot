/**
 * Integration test: /ws — WebSocket endpoint
 * ------------------------------------------------------------
 * Verifies that:
 *  - The Fastify WebSocket route accepts connections
 *  - The server responds with a "subscribed" message
 *  - The server pushes "update" messages periodically
 * ------------------------------------------------------------
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import registerRoutes from "../src/api/ws/routes.js";
import { WsAction, WsResponse } from "../src/model/defs.js";
import { WebSocket } from "ws";

let fastify;
let port;

beforeAll(async () => {
  fastify = Fastify({ logger: false });
  await registerRoutes(fastify);
  const address = await fastify.listen({ port: 0 }); // random free port
  port = new URL(address).port;
});

afterAll(async () => {
  await fastify.close();
});

describe("WebSocket /ws route", () => {
  it("should acknowledge subscription and send update messages", async () => {
    const url = `ws://localhost:${port}/ws`;
    const ws = new WebSocket(url);
    const received = [];

    const testPromise = new Promise((resolve, reject) => {
      ws.on("open", () => {
        // Send a subscribe request
        ws.send(
          JSON.stringify({ action: WsAction.SUBSCRIBE, jobId: "test123" })
        );
      });

      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        received.push(msg);

        // resolve once we've seen both message types
        const hasSubscribed = received.some(
          (m) => m.message === WsResponse.SUBSCRIBED
        );
        const hasUpdate = received.some((m) => m.type === "update");
        if (hasSubscribed && hasUpdate) {
          ws.close();
          resolve(received);
        }
      });

      ws.on("error", (err) => reject(err));
    });

    const messages = await testPromise;

    // Basic shape checks
    const subscribed = messages.find(
      (m) => m.message === WsResponse.SUBSCRIBED
    );
    const update = messages.find((m) => m.type === "update");

    expect(subscribed).toBeDefined();
    expect(subscribed.jobId).toBe("test123");

    expect(update).toBeDefined();
    expect(update).toHaveProperty("status");
  }, 15000); // allow 15s for WS loop
});
