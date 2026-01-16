import capabilities from "../config/capabilities.json" with { type: "json" };
import planeSchemaValidator from "./validators/capabilities/plane-manifest.schema-validator.cjs";
import redisConfigValidator from "./validators/redis/redis.config.schema-validator.cjs";
import bridgeConfig from "../config/redis.bridge.json" with { type: "json" };
import partialConfig from "../config/config.json" with { type: "json" };
import pipelinesConfig from "../config/pipelines.json" with { type: "json" };

const validatePlaneManifest = planeSchemaValidator.default;
const validateRedisConfig = redisConfigValidator.default;

let backendCapabilities = null;
let backendConfiguration = null;

export function getFixedPipelines() {
  return pipelinesConfig;
}

export function getCapabilities() {
  if (!backendCapabilities) {
    if (!validatePlaneManifest(capabilities)) {
      throw {
        error: `Invalid capabilities manifest: ${JSON.stringify(validatePlaneManifest.errors)}`,
      };
    }
    backendCapabilities = capabilities;
  }
  return backendCapabilities;
}

export function getConfiguration() {
  if (!backendConfiguration) {
    if (!validateRedisConfig(bridgeConfig)) {
      throw {
        error: `Invalid redis configuration: ${JSON.stringify(validateRedisConfig.errors)}`,
      };
    }
    partialConfig.persistence.url = process.env.POSTGRES_URL || "";
    partialConfig.storage = {
      url: process.env.MINIO_ENDPOINT || "",
      useSSL: process.env.MINIO_USE_SSL || "",
      bucket: process.env?.MINIO_BUCKETS?.split(",")[0] || [],
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
    };
    backendConfiguration = {
      bridge: bridgeConfig,
      ...partialConfig,
    };
  }
  return backendConfiguration;
}
