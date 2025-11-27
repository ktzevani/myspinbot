import { randomUUID } from "node:crypto";
import { getConfiguration } from "../config.js";
import jobQueue from "./job-queue.js";
import validateGraphSchema from "../validators/langgraph/graph.schema-validator.cjs";
import servicesRegistry from "../services/registry.js";
import { JobStatus } from "../model/defs.js";

const validateGraph = validateGraphSchema.default;

const DEFAULT_GROUP = "control-executor";
const POLL_INTERVAL_MS = 500;

class Executor {
  constructor(configuration, taskRegistry) {
    this.configuration = configuration;
    this.taskRegistry = taskRegistry;
    this.consumerGroup = DEFAULT_GROUP;
    this.consumerId = `executor-${randomUUID()}`;
    this.pollIntervalMs = POLL_INTERVAL_MS;
    this.timer = null;
    process.on("SIGTERM", () => this.stop());
    process.on("SIGINT", () => this.stop());
  }

  async start() {
    if (this.timer) return;
    await jobQueue.ensureControlGroup(this.consumerGroup);

    const poll = async () => {
      if (!this.timer) return;
      try {
        const job = await jobQueue.pollControlJob(
          this.consumerId,
          this.consumerGroup
        );
        if (job) {
          const result = await this.#processJob(job.id, job.fields);
          if (result.status === "completed") {
            await jobQueue.acknowledgeControlJob(
              result.entryId,
              this.consumerGroup
            );
            await jobQueue.publishProgress(result.jobId, 1);
            await jobQueue.publishStatus(result.jobId, JobStatus.COMPLETED);
          } else if (result.status === "handoff") {
            await jobQueue.acknowledgeControlJob(
              result.entryId,
              this.consumerGroup
            );
            await jobQueue.enqueueDataJob(
              result.jobId,
              JSON.stringify(result.graph)
            );
          }
        }
      } catch (err) {
        if (err?.entryId && err?.jobId) {
          await jobQueue.acknowledgeControlJob(err.entryId, this.consumerGroup);
          await jobQueue.publishProgress(err.jobId, 0);
          await jobQueue.publishStatus(err.jobId, JobStatus.FAILED);
        }
        console.error("[Executor]", err?.message || err);
      } finally {
        if (this.timer) this.timer = setTimeout(poll, this.pollIntervalMs);
      }
    };

    this.timer = setTimeout(poll, this.pollIntervalMs);
  }

  async stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async #processJob(entryId, fields) {
    const normalized = this.#fieldsToObject(fields);
    const jobId = normalized.jobId;
    const payload = normalized.graph;

    let graph = null;

    const procError = {
      message: "Invalid graph payload",
      entryId: entryId,
      jobId,
    };

    if (!jobId || !payload)
      throw { ...procError, message: "Missing jobId or payload" };

    try {
      graph = typeof payload === "string" ? JSON.parse(payload) : payload;
    } catch (err) {
      throw {
        ...procError,
        message: err?.message || procError.message,
      };
    }

    try {
      this.#validateGraph(graph);
    } catch (err) {
      throw {
        ...procError,
        message: err.message,
        details: validateGraph.errors,
      };
    }

    await jobQueue.publishStatus(jobId, JobStatus.RUNNING);
    return this.#executeGraph(entryId, jobId, graph);
  }

  #fieldsToObject(fields) {
    const obj = {};
    for (let i = 0; i < fields.length; i += 2) {
      obj[fields[i]] = fields[i + 1];
    }
    return obj;
  }

  #validateGraph(graph) {
    if (!validateGraph(graph)) {
      const details = (validateGraph.errors || []).map(
        (e) => `${e.instancePath || "/"} ${e.message}`
      );
      throw new Error(`Graph validation failed: ${details.join("; ")}`);
    }
    return true;
  }

  async #executeGraph(entryId, jobId, graph) {
    let readyNodes = this.#getReadyControlNodes(graph);
    const ret = { jobId, entryId, graph };

    while (readyNodes.length > 0) {
      try {
        await Promise.all(
          readyNodes.map((node) => this.#executeNode(jobId, graph, node))
        );
      } catch (err) {
        throw { ...ret, message: err?.message || String(err), cause: err };
      }
      readyNodes = this.#getReadyControlNodes(graph);
    }

    const isGraphCompleted = graph.nodes.every((n) => n.status == "completed");
    const isGraphFailed = graph.nodes.some((n) => n.status == "failed");
    const status = isGraphFailed
      ? "failed"
      : isGraphCompleted
        ? "completed"
        : "handoff";

    return { status, ...ret };
  }

  #getReadyControlNodes(graph) {
    const nodesById = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
    const incoming = {};
    for (const edge of graph.edges || []) {
      incoming[edge.to] = incoming[edge.to] || [];
      incoming[edge.to].push(edge.from);
    }

    const readyNodes = graph.nodes.filter((node) => {
      if (node.plane !== "node") return false;
      if (["completed", "running", "failed", "skipped"].includes(node.status))
        return false;
      const deps = incoming[node.id] || [];
      return deps.every((depId) => nodesById[depId]?.status === "completed");
    });

    for (const node of readyNodes || []) {
      for (const depId of incoming[node.id] || []) {
        node.input = { ...node.input, ...nodesById[depId]?.output };
      }
    }

    return readyNodes;
  }

  async #executeNode(jobId, graph, node) {
    try {
      const handler = this.taskRegistry.get(node.task);
      if (!handler) {
        node.status = "failed";
        node.error = { message: `No handler for task ${node.task}` };
      } else {
        node.output = await handler(
          {
            ...(node.params || {}),
            progressWeight: node?.progressWeight || 0,
            publishProgressCb: (step) => {
              jobQueue.publishProgress(jobId, step, true);
            },
            publishDataCb: (data) => {
              jobQueue.publishData(jobId, data);
            },
          },
          node.input || {}
        );
        node.status = "completed";
      }
    } catch (err) {
      node.status = "failed";
      node.error = { message: err?.message || String(err) };
    }
    await jobQueue.setJobPayload(jobId, graph);
  }
}

async function factory() {
  const executor = new Executor(getConfiguration(), servicesRegistry);
  await executor.start();
  return executor;
}

export const executor = await factory();
export default executor;
