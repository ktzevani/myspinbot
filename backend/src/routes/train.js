// ------------------------------------------------------------
// /api/train — Enqueue a training job
// ------------------------------------------------------------
// This endpoint introduces a job to the 'train' job queue and
// responsds with the generated job ID.
// ------------------------------------------------------------

import { enqueueJob } from "../controllers/queue.js";
import { JobStatus } from "../model/enums.js";
import { getConfiguration } from "../config.js";

const AppConfiguration = getConfiguration();

export default async function trainRoutes(fastify) {
  fastify.post("/train", async (_, reply) => {
    const jobId = await enqueueJob(
      AppConfiguration.bridge.jobs.available.PROCESS_GRAPH
    );
    return reply.send({
      jobId,
      status: JobStatus.QUEUED,
      progress: 0,
    });
  });
}
