import capabilities from "../config/capabilities.json" assert { type: "json" };
import planeSchemaValidator from "./validators/capabilities/plane-manifest.schema-validator.cjs";
import redisConfigValidator from "./validators/redis/redis.config.schema-validator.cjs";
import bridgeConfig from "../config/redis.bridge.json" assert { type: "json" };
import partialConfig from "../config/config.json" assert { type: "json" };

const validatePlaneManifest = planeSchemaValidator.default;
const validateRedisConfig = redisConfigValidator.default;

let backendCapabilities = null;
let backendConfiguration = null;

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
    backendConfiguration = {
      bridge: bridgeConfig,
      ...partialConfig,
    };
  }
  return backendConfiguration;
}
