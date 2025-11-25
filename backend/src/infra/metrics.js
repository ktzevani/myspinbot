import client from "prom-client";

export const MetricType = Object.freeze({
  GAUGE: client.Gauge,
  COUNTER: client.Counter,
  HISTOGRAM: client.Histogram,
  SUMMARY: client.Summary,
});

export function getOrCreateMetric(name, type, opts) {
  return (
    registry.getSingleMetric(name) ||
    new type({ name, ...opts, registers: [registry] })
  );
}

function factory() {
  const registry = new client.Registry();
  client.collectDefaultMetrics({ register: registry });
  return registry;
}

export const registry = factory();
export default registry;
