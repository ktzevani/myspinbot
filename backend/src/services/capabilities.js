import { getCapabilities } from "../config.js";
import validatorModule from "../validators/capabilities/plane-manifest.schema-validator.cjs";

const validatePlaneManifest = validatorModule.default;
const controlCapabilities = getCapabilities();

export async function getManifest(params, input) {
  const { publishDataCb = null } = params;
  const { workerCaps = "{}" } = input;
  const workerCapabilities = JSON.parse(workerCaps);

  if (!validatePlaneManifest(workerCapabilities)) {
    return validatePlaneManifest.errors;
  }

  const combinedManifest = {
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

  if (publishDataCb) {
    publishDataCb(JSON.stringify(combinedManifest));
  }

  return combinedManifest;
}
