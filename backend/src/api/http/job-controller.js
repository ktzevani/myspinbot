import jobQueue from "../../core/job-queue.js";
import { JobStatus } from "../../model/defs.js";
import { getConfiguration } from "../../core/config.js";

const AppConfiguration = getConfiguration();

export async function submitTrainJob() {
  const jobId = await jobQueue.enqueueJob(
    AppConfiguration.bridge.jobs.available.PROCESS_GRAPH
  );
  return { jobId, status: JobStatus.QUEUED, progress: 0 };
}

export async function getJobStatus(id) {
  const result = await jobQueue.getJobState(id);
  return { jobId: id, status: result.status, progress: result.progress };
}
