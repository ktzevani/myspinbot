# 🕸️ Dual-Plane LangGraph Orchestration with Agentic Planning

## Overview

The **Dual-Plane LangGraph Orchestration** model defines how MySpinBot infrastructure coordinates complex AI workflows across execution environments—the **Node.js Control Plane** environment and the **Python Data Plane** environment. 

Each environment implements its own **executor** facility able to poll designated Redis Streams and process incoming jobs. Each job contains an end-to-end AI workflow defined as a DAG graph in a common **LangGraph JSON** format shared among the facilities of MySpinBot monorepo (for more information read [shared shemas](./shared_schemas.md)). This workflow is typically a *hybrid execution graph* which composes of two types of nodes, one for describing processing tasks that target the control plane and are meant to be handled by the plane's (**Node.js control process**) executor, and another that targets the data plane that is being handled by its corresponding (**Python worker process**) executor. 

At any given time a job can be active on either the control plane or the data plane, but not both. Hence, parallel execution of the same job is not supported across planes. 

> 🚀 **[Future Work]:** Same limitations will not apply during in-plane processing though, **in-plane parallel execution of independent sub-tasks** will be supported, see [below](#7-future-work).

During the distributed processing of a job, the graph is being communicated back and forth across the planes through the Redis Streams as execution progresses. Each side processes the ready-to-be-executed nodes of it's respective type reflecting sub-tasks assigned to the specific plane, ensuring modularity, transparency, and resilience while at the same time respecting node inter-dependencies guaranteeing the execution order that the workflow imposes.

> 🚀 **[Future Work]:** Building upon this foundation, MySpinBot will introduce a fully autonomous **Agentic Planning Layer**, for details see [below](#7-future-work).

## 1. Architectural Concept

| Plane             | Runtime                          | Responsibilities                                                                                                                                                      |
| ----------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Control Plane** | Node.js + LangGraph.js           | Defines and initializes graphs, executes API and LLM-related nodes, manages workflow state, load hybrid graphs from file (to be replaced by agentic planning), and coordinates handoffs. |
| **Data Plane**    | Python + LangGraph.py | Executes GPU-intensive tasks such as LoRA training, TTS synthesis, rendering, or diffusion; publishes progress metrics and places updated graph state back in streams.               |

Both planes operate on the same declarative LangGraph representation, which describes **what** should happen (the DAG structure and parameters) but not **how** each node is implemented. Each node references the actual task by a qualified service name which acts as service/task ID. The list of available services each plane support along with descriptions of each service (to be used by the planner) are advertised in the [**plane's capabilities manifest**](./shared_schemas.md#8-capabilities-system-overview). The actual implementation is bound dynamically at runtime by each plane using its plane-local task registry.

## 2. Fixed Custom Workflows

>  🚀 **[Future Work]:** To be replaced by the **Planning Layer**, see [below](#7-future-work).

At current project phase instead of a fully autonomous planning layer as is planned in projects roadmap, **MySpinBot** supports the definition and consumption of custom workflows in JSON format. The *backend API* provides endpoints their internal logic of which configure and invoke these predefined custom workflows which in turn the *frontend layer* makes use of to provide to users the means to initiate the execution, e.g. generation of a video of a speaking avatar taking as input a single image, an audio voice sample and a reference text for that sample to train the voice synthesis.

This custom workflows are looking like following:

```json
  "f5tts_infinitetalk": {
    "nodes": [
      {
        "id": "script",
        "name": "Generate script",
        "service": "llm.generate_script",
        "plane": "node",
        "progressWeight": 0.05
      },
      {
        "id": "f5_to_tts",
        "name": "Generate voice (F5-TTS)",
        "service": "generate.f5_to_tts",
        "plane": "python",
        "progressWeight": 0.1
      },
      {
        "id": "infinite_talk",
        "name": "Generate speech video",
        "service": "generate.infinite_talk",
        "plane": "python",
        "progressWeight": 0.45
      },
      {
        "id": "upscale_video",
        "name": "Upscale video with AI",
        "service": "generate.upscale_video",
        "plane": "python",
        "progressWeight": 0.4
      }
    ],
    "edges": [
      {
        "from": "script",
        "to": "f5_to_tts",
        "kind": "normal"
      },
      {
        "from": "f5_to_tts",
        "to": "infinite_talk",
        "kind": "normal"
      },
      {
        "from": "infinite_talk",
        "to": "upscale_video",
        "kind": "normal"
      }
    ]
  }
```

## 3. Core Execution Model

1. **Load Graph Definition**
    - Custom hybrid execution graphs are predefined and reside in `./backend/config/pipelines.json` file.
    - Fixed logic in backend loads the graph from file.
    - Each node specifies a `service` name, targeted `plane`, and task-specific parameters
    - The graph is serialized to JSON and enqueued via Redis Streams.

>  🚀 **[Future Work]:** This will be replaced by **Graph Definition from Agentic Planner**, see details [below](#7-future-work).

2. **Execution**

   - Plane executor is constantly polling Redis Streams for new jobs. When a new jobs is in the stream it claims it and acquires the workflow graph.
   - Then each runtime processes the workflow graph in a similar manner:

     ```python
     async def _process_job(self, entry: Dict[str, Any]) -> ExecutorResult:
     # Acquire workflow out of payload (entry)
     workflow = LanggraphWorkflow.model_validate(raw_graph)
     graph = workflow.model_dump(mode="python", by_alias=True)
     # ...
     status = await self.execute_graph(graph)
     # return status via ExecutorResult
     ```

     or

     ```js
     async #processJob(entryId, fields) {
      // Acruire graph out of payload (fields)
      this.#validateGraph(graph);
      //...
      return this.#executeGraph(entryId, jobId, graph);
     }
     ```

   - LangGraph automatically detects which nodes are ready (dependencies satisfied, plane matches current runtime, status not completed) and marks them for execution.
   - Executor loop processes each of these nodes sequentialy
   - `status` fields of completed nodes are updated according to the outcome and any output is stored in node properties for the downstream nodes to use (i.e. so the state of the entire graph gets updated as nodes are processed and the workflow progresses).

>  🚀 **[Future Work]:** Current sequential processing of ready nodes will be replaced by parallel one in both planes, see [below](#7-future-work).

3. **Handoff Cycle and Job Termination**

   - When no further nodes of the current plane remain executable, the runtime serializes the updated graph and publishes it back to the Redis stream for the opposite plane.
   - Example:
     - Node.js after finishing local nodes: `XADD jobs:python ...`
     - Python worker after finishing GPU nodes: `XADD jobs:node ...`
   - There are two termination criteria which will break the handoff cycle and signify job completion:
      - a. Job is processed by control plane and all nodes are in `completed` status.
      - b. Job is processed by either plane and at least on node is in `failed` status. 

4. **Resumption and Continuation**

   - Since job processing is backed by persistence, the system can resume disrupted jobs at any given time.
   - At each step of the process the distributed pipeline makes sure that updated graphs are persisted.
   - Upon disruption, control plane reissues all unfinished jobs back to the streams and execution continues seamlessly until all jobas are processed and acknoledged.

## 4. Data Model Summary

A serialized graph JSON looks like this:

```json
{
  "schema": "langgraph.v1",
  "workflowId": "example_workflow_001",
  "context": { ... },
  "metadata": { ... },
  "nodes": [
    { "id": "A", "name": "Generate script", "name": "generate_script", "plane": "node", "progressWeight": 0.5 },
    { "id": "B", "name": "Train voice", "name": "train_voice", "plane": "python", "progressWeight": 0.5 }
  ],
  "edges": [ { "from": "A", "to": "B", "kind": "normal" } ]
}
```

### Node fields

| Field            | Description                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `id`             | Unique node identifier                                                                               |
| `name`           | Human-readable node label                                                                            |
| `service`        | Service name reference corresponding to service id from capabilities manifest                        |
| `plane`          | Defines which runtime the node targets (`node` or `python`). **TO BE REPLACED WITH** `control` or `data` |
| `status`         | Execution state (`pending`, `running`, `completed`, `failed`)                                        |
| `progressWeight` | An estimate about the portion of job time this task will take (0, 1]                                 |
| `params`         | [Optional/Staged] Task-specific parameters                                                           |
| `status`         | [Staged] Node status                                                                                 |
| `output`         | [Optional/Staged] Output payload (e.g. artifact URI) for dependent downstream nodes                  |

## 5. Serialization Rules

- **Declarative only:** no executable code crosses boundaries; both planes share only data.
- **Bindings:** each runtime maintains its own task registry and is responsible for constructing and returning upon request it **capabilities manifest** listing the supported services.
- **Outputs:** the output of each node must be JSON-serializable, stored in `output` node property and composed in case of raw/large artifacts of reference URIs to objects storage (e.g., MinIO paths).
- **Status updates:** executor updates the status of each node and its output property after a sub-task is finished and before the next processing cycle.

## 6. Advantages of the design

- **Single Source of Truth:** one declarative graph describes the entire job lifecycle.
- **Fault Tolerance:** each graph snapshot is self-contained and can be reloaded after crash or restart.
- **Language-Agnostic:** Node and Python share same schema.
- **Observability:** consistent progress tracking and Prometheus metrics across both planes.
- **Extensibility:** new task types can be added simply by registering handlers in either runtime and advertising them in the capabilities manifest.

- **Dynamic Agentic Planning:** LLM-driven agent synthesizes hybrid workflows dynamically from structure prompts and worker capabilities.

The planner uses this data to compose a LangGraph JSON with the correct sequence of nodes, planes, and dependencies.

## 7. Future Work

The future enhanced version of **Dual-Plane LangGraph Orchestration** will introduce an intelligent agent living on control plane, capable of generating hybrid workflows from user goals and system capabilities. This agentic layer will create a context-aware LangGraph specification that spans both Node.js and Python runtimes. This future roadmap envisions the planner itself becoming iterative and self-evaluating—a step toward a truly autonomous orchestration system capable of reasoning, planning, and optimizing its own execution graphs dynamically. 

Below are listed all future enhancements that **dual-plane orchestration** layer will undergo as the project evolves to reach said goals:

- **Agentic Planner** is to be introduced in place of **custom workflows**. This will be carried out in two phases
  1. It will initially be defined as a **single-pass planner** where the underlying llm will take a templatized prompt with the user input, the capabilities manifest and the hybrid execution graph schema and it will output a custom workflow for the infrastructure to process.

  2. The previous simple planner will be evolved into an **autonomous iterative planning agent** with the addition of its own **evaluation layer** that will be utilized to close the agentic loop. In this design, the planner would generate **intermediate LangGraphs** as part of an optimization process until it conclude to the optimal one that satisfies user input and evaluator criteria. 

  The **evaluation loop** will address things like:

  - Testing partial plans or subgraphs for feasibility.
  - Evaluating cost, duration, or quality metrics before committing to full execution.
  - Iteratively refining workflows using feedback from prior subgraph runs.

  This will open the door for **self-optimizing orchestration**, where the planner incrementally converges on efficient hybrid workflows through controlled experimentation.

  Under this assumptions an example of a structured prompt to initiate the agentic planning could look like this:

  ```json
  {
    "goal": "Generate a 30-second educational video explaining how solar panels work.",
    "user_context": {
      "user_id": "myspinbot_user",
      "preferred_voice": "female",
      "style": "scientific"
    },
    "capabilities_manifest": {
      "python": {
        "train_lora": { "gpu": true, "desc": "LoRA fine-tuning" },
        "render_video": { "gpu": true, "desc": "Video rendering via ComfyUI" },
        "synthesize_voice": { "gpu": false, "desc": "Text-to-speech synthesis" }
      },
      "node": {
        "generate_script": { "desc": "Scriptwriting via LLM" },
        "upload_artifact": { "desc": "Upload to storage bucket" }
      }
    },
    "constraints": {
      "max_duration": 30,
      "output_format": "mp4"
    }
  }
  ```

- **In-plane parallel execution of independent sub-tasks** will be enabled in future iteration.
  - Data plane executor will support this with the introduction of **Dramatiq**
  - Control plane with **BullMQ**
  
  In both cases horizontal scaling will be additionally introduced to enable multiple job processing in parallel (i.e. **multiple instances** of control plane backends and data plane workers will get into play).
