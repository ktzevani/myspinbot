import { getCapabilities } from "../config.js";
import validatorModule from "../validators/capabilities/plane-manifest.schema-validator.cjs";

const validatePlaneManifest = validatorModule.default;
const controlCapabilities = getCapabilities();

export async function getManifest(caps) {
  const workerCapabilities = caps;
  if (!validatePlaneManifest(workerCapabilities)) {
    return validatePlaneManifest.errors;
  }

  return {
    generatedAt: new Date().toISOString(),
    capabilities: [
      ...controlCapabilities.capabilities,
      ...workerCapabilities.capabilities,
    ],
    sources: {
      control: {
        plane: controlCapabilities.plane,
        number: controlCapabilities.capabilities.length,
      },
      worker: {
        plane: workerCapabilities.plane,
        number: workerCapabilities.capabilities.length,
      },
    },
  };
}
