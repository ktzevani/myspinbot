import { jobQueue, JobQueueError } from "../../core/job-queue.js";
import jobSchemaValidator from "../../validators/jobs/job-messaging.schema-validator.cjs";
import { randomUUID } from "node:crypto";
import { Planner } from "../../core/planner.js";

const validateJobResponse = jobSchemaValidator.default;

export async function submitTrainJob(requestBody = {}) {
  const jobId = randomUUID();
  const planner = new Planner();
  const graph = planner.getJobGraph({
    workflowId: jobId,
    request: requestBody,
  });
  return await jobQueue.enqueueControlJob(jobId, graph);
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
