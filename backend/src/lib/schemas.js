export const JobStatus = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  NOT_FOUND: "not_found",
});

export const WsAction = Object.freeze({
  SUBSCRIBE: "subscribe",
  UNSUBSCRIBE: "unsubscribe",
  RESPONSE: "response",
});

export const WsResponse = Object.freeze({
  SUBSCRIBED: "subscribed",
  UNSUBSCRIBED: "unsubscribed",
  FAILED: "failed",
});

export const CAPABILITY_VERSION = "2025.02.0";

export function describeCapabilityFields() {
  return {
    id: "Unique string identifier (machine readable).",
    label: "Human-readable label used in UIs/agents.",
    description: "Summary of what the capability does.",
    version: "Semantic version of the manifest.",
    plane: "Execution plane hint (node).",
    runtime: {
      kind: "cpu/gpu… here always cpu.",
      timeoutSeconds: "Execution timeout guard.",
      concurrency: "Max concurrent invocations allowed.",
    },
    handler: {
      module: "Path to the module exporting the resolver.",
      method: "Exported method/function name.",
    },
    io: {
      input: "JSON Schema describing accepted payloads.",
      output: "JSON Schema describing the response.",
    },
    parameters:
      "Optional structured parameters list (name/type/description/required).",
    examples: "Example payloads/responses for planner grounding.",
    telemetry: "Flags describing progress events or custom metrics.",
    security: "Whether secrets/scoped credentials are required.",
    contracts:
      "Operational guarantees: idempotency, side effects, determinism, etc.",
  };
}

export const CapabilityPlane = Object.freeze({
  NODE: "node",
  PYTHON: "python",
});

export const CapabilityRuntimeKind = Object.freeze({
  CPU: "cpu",
  GPU: "gpu",
});

export const CapabilitySchema = Object.freeze({
  version: CAPABILITY_VERSION,
  plane: CapabilityPlane.NODE,
  runtimeKinds: CapabilityRuntimeKind,
  fields: describeCapabilityFields(),
});
