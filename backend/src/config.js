import capabilities from "../config/capabilities.json" assert { type: "json" };
import planeSchemaValidator from "./validators/capabilities/plane-manifest.schemaValidator.cjs";
import redisConfigValidator from "./validators/redis/redis.config.schemaValidator.cjs";
import bridgeConfig from "../config/redis.bridge.json" assert { type: "json" };

const validatePlaneManifest = planeSchemaValidator.default;
const validateRedisConfig = redisConfigValidator.default;

let backendCapabilities = null;
let backendConfiguration = null;

export function getCapabilities() {
  if (!backendCapabilities) {
    if (!validatePlaneManifest(capabilities)) {
      throw {
        error: `Invalid capabilities manifest: ${validatePlaneManifest.error}`,
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
        error: `Invalid redis configuration: ${validateRedisConfig.error}`,
      };
    }
    backendConfiguration = {
      bridge: bridgeConfig,
    };
  }
  return backendConfiguration;
}
