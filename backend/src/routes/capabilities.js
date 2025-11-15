import { enqueueJob, getJobResult } from "../controllers/queue.js";
import validatorModule from "../validators/capabilities/plane-manifest.schemaValidator.cjs";
import { getConfiguration, getCapabilities } from "../config.js";

const AppConfiguration = getConfiguration();
const validatePlaneManifest = validatorModule.default;
const plannerCapabilities = getCapabilities();

async function getCombinedManifest() {
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

export default async function capabilitiesRoute(fastify) {
  fastify.get("/capabilities", async (_req, reply) => {
    const manifest = await getCombinedManifest();
    return reply.send(manifest);
  });
}
