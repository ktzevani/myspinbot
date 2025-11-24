import validatorModule from "../../validators/capabilities/plane-manifest.schema-validator.cjs";
import { getConfiguration, getCapabilities } from "../../core/config.js";
import { enqueueJob, getJobResult } from "../../core/queue.js";

const AppConfiguration = getConfiguration();
const validatePlaneManifest = validatorModule.default;
const plannerCapabilities = getCapabilities();

export async function getCapabilitiesManifest() {
  const jobId = await enqueueJob(
    AppConfiguration.bridge.jobs.available.GET_CAPABILITIES
  );
  const workerCapabilities = JSON.parse(await getJobResult(jobId));
  if (!validatePlaneManifest(workerCapabilities)) {
    return validatePlaneManifest.errors;
  }

  return {
    generatedAt: new Date().toISOString(),
    capabilities: [
      ...plannerCapabilities.capabilities,
      ...workerCapabilities.capabilities,
    ],
    sources: {
      control: {
        plane: plannerCapabilities.plane,
        number: plannerCapabilities.capabilities.length,
      },
      worker: {
        plane: workerCapabilities.plane,
        number: workerCapabilities.capabilities.length,
      },
    },
  };
}
