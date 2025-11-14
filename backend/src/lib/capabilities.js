import {
  CAPABILITY_VERSION,
  CapabilityPlane,
  CapabilityRuntimeKind,
} from "./schemas.js";

export function createParameter({
  name,
  type,
  description,
  required = false,
  enum: enumValues,
  defaultValue,
}) {
  if (!name || !type) {
    throw new Error("capability parameter requires name and type");
  }
  return Object.freeze({
    name,
    type,
    description: description ?? "",
    required,
    enum: enumValues,
    default: defaultValue,
  });
}

export function defineNodeCapability({
  id,
  label,
  description,
  version = CAPABILITY_VERSION,
  handler,
  inputSchema,
  outputSchema,
  parameters = [],
  examples = [],
  timeoutSeconds = 120,
  concurrency = 1,
  telemetry = {},
}) {
  if (!id || !label || !handler?.module || !handler?.method) {
    throw new Error(
      "capability requires id, label, handler.module, handler.method"
    );
  }

  return Object.freeze({
    id,
    label,
    description: description ?? "",
    version,
    plane: CapabilityPlane.NODE,
    runtime: {
      kind: CapabilityRuntimeKind.CPU,
      timeoutSeconds,
      concurrency,
    },
    handler,
    io: {
      input: inputSchema ?? { type: "object", properties: {} },
      output: outputSchema ?? { type: "object", properties: {} },
    },
    parameters,
    examples,
    telemetry: {
      emitsProgressEvents: Boolean(telemetry.emitsProgressEvents),
      metrics: telemetry.metrics ?? [],
    },
    security: {
      requiresSecrets: telemetry.requiresSecrets ?? false,
    },
    contracts: {
      idempotent: Boolean(telemetry.idempotent ?? false),
      sideEffects: telemetry.sideEffects ?? "bounded",
    },
  });
}

const capabilityDefinitions = [
  defineNodeCapability({
    id: "artifacts.upload_artifact",
    label: "Upload Artifact",
    description:
      "Persists user-provided images (and optional audio) into MinIO as a versioned artifact.",
    handler: {
      module: "services/artifacts.js",
      method: "uploadArtifact",
    },
    inputSchema: {
      type: "object",
      required: ["images"],
      properties: {
        artifactId: {
          type: ["string", "null"],
          description: "Optional id override",
        },
        images: {
          type: "array",
          minItems: 1,
          items: { type: "string", description: "Base64 or presigned URL" },
        },
        audio: {
          type: ["string", "null"],
          description: "Optional audio sample (Base64 / presigned URL)",
        },
        metadata: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        artifactId: { type: "string" },
        bucket: { type: "string" },
        objects: {
          type: "object",
          properties: {
            images: { type: "array", items: { type: "string" } },
            audio: { type: ["string", "null"] },
          },
        },
      },
    },
    parameters: [
      createParameter({
        name: "bucket",
        type: "string",
        description: "MinIO bucket destination",
        required: true,
      }),
      createParameter({
        name: "prefix",
        type: "string",
        description: "Object key prefix for grouped assets",
      }),
    ],
    telemetry: {
      emitsProgressEvents: true,
      metrics: ["minio_upload_bytes"],
      sideEffects: "persistent-storage-write",
    },
  }),
  defineNodeCapability({
    id: "artifacts.prepare_assets",
    label: "Prepare Assets",
    description:
      "Builds an asset manifest describing stored artifact contents (locations, checksums, media metadata).",
    handler: {
      module: "services/artifacts.js",
      method: "prepareAssets",
    },
    inputSchema: {
      type: "object",
      required: ["artifactId"],
      properties: {
        artifactId: { type: "string" },
        requestedKinds: {
          type: "array",
          items: { type: "string", enum: ["images", "audio"] },
        },
        enrichments: {
          type: "object",
          properties: {
            imageHashes: { type: "boolean" },
            audioDuration: { type: "boolean" },
          },
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        artifactId: { type: "string" },
        manifest: {
          type: "object",
          properties: {
            images: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  checksum: { type: "string" },
                  width: { type: "number" },
                  height: { type: "number" },
                },
              },
            },
            audio: {
              type: ["object", "null"],
              properties: {
                key: { type: "string" },
                durationSeconds: { type: "number" },
              },
            },
          },
        },
      },
    },
    telemetry: {
      emitsProgressEvents: false,
      idempotent: true,
      metrics: ["asset_manifest_latency_ms"],
    },
  }),
  defineNodeCapability({
    id: "llm.generate_script",
    label: "Generate Script",
    description:
      "Transforms a user prompt into a stage description + narration using a local LLM and prompt template.",
    handler: {
      module: "services/scriptGenerator.js",
      method: "generateScript",
    },
    inputSchema: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string" },
        tone: {
          type: "string",
          enum: ["casual", "formal", "playful", "dramatic"],
        },
        length: {
          type: "number",
          description: "Desired narration length in seconds",
        },
        persona: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        stagePrompt: { type: "string" },
        narration: { type: "string" },
        tokensUsed: { type: "number" },
      },
    },
    parameters: [
      createParameter({
        name: "model",
        type: "string",
        description: "Local LLM model identifier served by Ollama/OpenWebUI",
        required: true,
      }),
      createParameter({
        name: "temperature",
        type: "number",
        description: "LLM sampling temperature",
        defaultValue: 0.4,
      }),
    ],
    telemetry: {
      emitsProgressEvents: false,
      metrics: ["llm_tokens_total"],
      idempotent: false,
    },
  }),
];

const registry = new Map(capabilityDefinitions.map((c) => [c.id, c]));

export function listNodeCapabilities() {
  return capabilityDefinitions.slice();
}

export function getCapability(capabilityId) {
  return registry.get(capabilityId) ?? null;
}

export function getCapabilitiesManifest() {
  return {
    generatedAt: new Date().toISOString(),
    plane: CapabilityPlane.NODE,
    capabilities: listNodeCapabilities(),
  };
}
