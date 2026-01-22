import { getConfiguration } from "../../config.js";
import jobQueue from "../../core/job-queue.js";
import { randomUUID } from "node:crypto";
import { Planner } from "../../core/planner.js";

const appConfig = getConfiguration();

const capsGraph = {
  nodes: [
    {
      id: "worker.info",
      name: "Get Worker Capabilities",
      service: "info.get_capabilities",
      plane: "python",
      status: "pending",
      progressWeight: 0.5,
    },
    {
      id: "control.info",
      name: "Combined Capabilities Manifests",
      service: "info.get_capabilities",
      plane: "node",
      status: "pending",
      progressWeight: 0.5,
    },
  ],
  edges: [{ from: "worker.info", to: "control.info", kind: "normal" }],
};

export async function getCapabilitiesManifest() {
  const jobId = randomUUID();
  const planner = new Planner(appConfig);
  const graph = planner.getJobGraph({
    workflowId: jobId,
    input: {
      mode: "process_graph",
      graph: JSON.stringify(capsGraph),
    },
  });
  jobQueue.enqueueDataJob(jobId, graph);
  const graphObj = JSON.parse(await jobQueue.getJobResult(jobId));
  return graphObj?.nodes[1]?.output;
}
