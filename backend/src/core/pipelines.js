import { getConfiguration, getFixedPipelines } from "../config.js";

const appConfig = getConfiguration();
const registry = getFixedPipelines();

export class PipelineError extends Error {
  constructor(msg) {
    super(msg);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

const PipelineModes = appConfig.bridge.planning.pipelines;

function constructGraphObject(variant, params) {
  let graph = JSON.parse(JSON.stringify(registry[variant]));
  for (let node of graph.nodes) {
    if (node.id in params) {
      node.params = { ...(node.params || {}), ...params[node.id] };
    }
    node.status = "pending";
  }
  return graph;
}

export function generateGraph(input) {
  if (!input) throw new PipelineError("[Pipelines] Empty request input");
  const { params, graph, ...pipelineMeta } = input;
  let graphObj = null;

  if (!pipelineMeta.mode)
    throw new PipelineError(
      "[Pipelines] Malformed request input (is mode missing?)."
    );
  if (!Object.values(PipelineModes).includes(pipelineMeta.mode))
    throw new PipelineError(
      `[Pipelines] Invalid request input, unknown input mode (${pipelineMeta.mode})`
    );

  switch (pipelineMeta.mode) {
    case PipelineModes.PROCESS:
      if (!graph)
        throw new PipelineError(
          "[Pipelines] Malformed request input (is graph missing?)."
        );
      graphObj = JSON.parse(graph);
      break;
    case PipelineModes.FIXED:
      if (!pipelineMeta.variant || !params)
        throw new PipelineError(
          "[Pipelines] Malformed request input (is variant or params missing?)."
        );
      if (!Object.keys(registry).includes(pipelineMeta.variant))
        throw new PipelineError(
          `[Pipelines] Invalid request input, unknown variant (${pipelineMeta.variant})`
        );
      graphObj = constructGraphObject(pipelineMeta.variant, params);
      break;
  }

  return {
    ...graphObj,
    pipelineMeta,
  };
}
