import client from "prom-client";

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export async function getMetrics() {
    return { type: register.contentType, metrics: register.metrics() };
};