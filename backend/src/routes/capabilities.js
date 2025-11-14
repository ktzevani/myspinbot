import { getCapabilitiesManifest } from "../lib/capabilities.js";
import { enqueueJob, getJobResult } from "../controllers/queue.js";

async function getCombinedManifest() {
  const jobId = await enqueueJob("get_capabilities");
  const workerCapabilities = await getJobResult(jobId);
  const plannerCapabilities = getCapabilitiesManifest();

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
