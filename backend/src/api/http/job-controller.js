import { jobQueue, JobQueueError } from "../../core/job-queue.js";
import { JobStatus } from "../../model/defs.js";
import { getConfiguration } from "../../config.js";
import jobSchemaValidator from "../../validators/jobs/job-messaging.schema-validator.cjs";

const validateJobResponse = jobSchemaValidator.default;
const AppConfiguration = getConfiguration();

export async function submitTrainJob() {
  const jobId = await jobQueue.enqueueJob(
    AppConfiguration.bridge.jobs.available.PROCESS_GRAPH
  );
  return { jobId, status: JobStatus.QUEUED, progress: 0 };
}

export async function getJobStatus(id) {
  try {
    const state = await jobQueue.getJobState(id);
    if (validateJobResponse(state)) {
      return state;
    } else {
      return { error: "Unknown job state format." };
    }
  } catch (err) {
    if (err instanceof JobQueueError) {
      return err;
    }
    throw err;
  }
}
