import { getConfiguration } from "../config.js";
import validateGraphSchema from "../validators/langgraph/graph.schema-validator.cjs";
import { buildPipelineGraph } from "./pipelines.js";

const LANGGRAPH_SCHEMA_VERSION = "langgraph.v1";

const validator = validateGraphSchema.default;

export class Planner {
  constructor(configuration = getConfiguration()) {
    this.configuration = configuration;
  }

  #buildGraph(request = {}) {
    return buildPipelineGraph(request);
  }

  #validateDAG(nodes = [], edges = []) {
    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      throw new Error("Planner received invalid graph structure");
    }

    const nodeIds = new Set();
    for (const node of nodes) {
      if (!node?.id || typeof node.id !== "string") {
        throw new Error("Planner graph nodes must include string ids");
      }
      if (nodeIds.has(node.id)) {
        throw new Error(`Duplicate node id detected: ${node.id}`);
      }
      nodeIds.add(node.id);
    }

    const adjacency = new Map();
    const indegree = new Map();
    const outdegree = new Map();

    for (const id of nodeIds) {
      adjacency.set(id, []);
      indegree.set(id, 0);
      outdegree.set(id, 0);
    }

    for (const edge of edges) {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        throw new Error(
          `Planner graph edge references unknown node: ${edge.from} -> ${edge.to}`
        );
      }
      adjacency.get(edge.from).push(edge.to);
      indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
      outdegree.set(edge.from, (outdegree.get(edge.from) ?? 0) + 1);
    }

    // Cycle detection (DFS)
    const visited = new Set();
    const inStack = new Set();
    const hasCycle = (nodeId) => {
      if (inStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);
      inStack.add(nodeId);
      for (const next of adjacency.get(nodeId) || []) {
        if (hasCycle(next)) return true;
      }
      inStack.delete(nodeId);
      return false;
    };
    for (const id of nodeIds) {
      if (hasCycle(id)) {
        throw new Error("Planner graph contains a cycle");
      }
    }

    // Reachability: ensure every node is reachable from at least one source.
    const sources = [...nodeIds].filter((id) => (indegree.get(id) ?? 0) === 0);
    if (sources.length === 0 && nodeIds.size > 0) {
      throw new Error("Planner graph has no entry nodes (indegree = 0)");
    }
    const reachable = new Set();
    const stack = [...sources];
    while (stack.length > 0) {
      const current = stack.pop();
      if (reachable.has(current)) continue;
      reachable.add(current);
      for (const next of adjacency.get(current) || []) {
        stack.push(next);
      }
    }
    if (reachable.size !== nodeIds.size) {
      throw new Error("Planner graph has unreachable nodes");
    }

    return { nodeIds, indegree, outdegree, sources };
  }

  getJobGraph({ workflowId, context = {}, metadata = {}, request = {} }) {
    const partialGraph = this.#buildGraph(request);

    try {
      this.#validateDAG(partialGraph.nodes, partialGraph.edges);
    } catch (err) {
      throw new Error(`Planner produced invalid graph: ${err?.message}`);
    }

    const pipelineMeta = partialGraph.pipelineMeta || {};
    const mergedPipelineMeta = {
      ...(metadata.pipeline || {}),
      ...pipelineMeta,
    };

    const fullGraph = {
      schema: LANGGRAPH_SCHEMA_VERSION,
      workflowId: workflowId,
      context: {
        ...context,
        pipeline: mergedPipelineMeta,
      },
      metadata: {
        ...metadata,
        planner: "control-plane",
        version: this.configuration.version ?? "unknown",
        pipeline: mergedPipelineMeta,
      },
      nodes: partialGraph.nodes,
      edges: partialGraph.edges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        kind: edge.kind ?? "normal",
      })),
    };

    const valid = validator(fullGraph);
    if (!valid) {
      const errorDetails = validator.errors
        ?.map((err) => `${err.instancePath || "/"} ${err.message}`)
        .join("; ");
      throw new Error(`Planner produced invalid graph: ${errorDetails}`);
    }

    return JSON.stringify(fullGraph);
  }
}
