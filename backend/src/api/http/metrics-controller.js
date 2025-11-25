import registry from "../../infra/metrics.js";

export async function getMetrics() {
  return { type: registry.contentType, metrics: registry.metrics() };
}
