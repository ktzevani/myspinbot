import { Graph, START, END } from "@langchain/langgraph";
import { getConfiguration } from "../config.js";
import validateGraphSchema from "../validators/langgraph/graph.schema-validator.cjs";

const LANGGRAPH_SCHEMA_VERSION = "langgraph.v1";

const validator = validateGraphSchema.default ?? validateGraphSchema;

const defaultGraphTemplate = {
  nodes: [
    {
      id: "scripting",
      name: "Generate bot script",
      task: "script.generateScript",
      plane: "node",
      status: "pending",
    },
    {
      id: "training",
      name: "Execute GPU tasks",
      task: "train_lora",
      plane: "python",
      status: "pending",
    },
  ],
  edges: [{ from: "scripting", to: "training", kind: "normal" }],
};

export class Planner {
  constructor(
    configuration = getConfiguration(),
    template = defaultGraphTemplate,
    input = { prompt: "Default prompt" }
  ) {
    this.configuration = configuration;
    this.graphTemplate = template;
    this.graphInput = input;
  }

  #buildGraph() {
    return {
      ...JSON.parse(JSON.stringify(this.graphTemplate)),
      params: this.graphInput,
    };
  }

  #validateWithLangGraph(nodes, edges) {
    const graph = new Graph();
    for (const node of nodes) {
      graph.addNode(node.id, async (state) => state);
    }
    const entry = nodes[0]?.id;
    if (entry) {
      graph.addEdge(START, entry);
    }
    for (const edge of edges) {
      graph.addEdge(edge.from, edge.to);
    }
    if (nodes.length > 0) {
      graph.addEdge(nodes.at(-1).id, END);
    }
    graph.validate();
  }

  getJobGraph({ workflowId, context = {}, metadata = {} }) {
    const graphTemplate = this.#buildGraph();
    this.#validateWithLangGraph(graphTemplate.nodes, graphTemplate.edges);

    const jobGraph = {
      schema: LANGGRAPH_SCHEMA_VERSION,
      workflowId: workflowId,
      context,
      metadata: {
        planner: "control-plane",
        version: this.configuration.version ?? "unknown",
        ...metadata,
      },
      nodes: graphTemplate.nodes,
      edges: graphTemplate.edges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        kind: edge.kind ?? "normal",
      })),
    };

    const valid = validator(jobGraph);
    if (!valid) {
      const errorDetails = validator.errors
        ?.map((err) => `${err.instancePath || "/"} ${err.message}`)
        .join("; ");
      throw new Error(`Planner produced invalid graph: ${errorDetails}`);
    }

    return JSON.stringify(jobGraph);
  }
}
