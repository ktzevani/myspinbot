# Architecture Overview

This document describes the current MySpinBot architecture at multiple levels: a high-level component map, the dual-plane execution model, concrete training and capabilities workflows, and user interaction flows. The design has evolved through multiple planned development cycles; see `06_history.md` for a summary of that evolution.

## 1) High‑Level System Architecture

**Description:**  
The platform is a local, multi-service stack organized around a **control plane** (Node.js backend) that orchestrates LangGraph workflows, a **data plane** (Python worker) that executes heavy GPU-powered tasks, a Next.js frontend, and shared infrastructure for storage, routing, and observability. All services run on a shared Docker network and expose metrics for unified monitoring.

**System Map**

```mermaid
flowchart LR
    %% Ingress & UI
    subgraph Ingress["Traefik Ingress"]
        T{{TLS & Routing}}
    end

    subgraph Frontend["Experience Layer (frontend/)"]
        UI[Next.js Web App]
    end

    subgraph ControlPlane["Control Plane — backend/ (Node.js)"]
        API[Fastify API + WebSocket]
        PLNR["Planner (LangGraph.js)"]
        EXEC["Control Executor"]
        JQ["JobQueue (Redis Streams + Pub/Sub)"]
    end

    subgraph DataPlane["Data Plane — worker/ (Python)"]
        WAPI[FastAPI /health + /metrics]
        WBR["Redis Bridge (Streams + Pub/Sub)"]
        WEXEC["Worker Executor (LangGraph.py)"]
        TASKS["Task Registry (train_lora, train_voice, render_video, get_capabilities)"]
    end

    subgraph Data["State & Storage"]
        R[(Redis — Streams + Pub/Sub)]
        S3[(MinIO / S3)]
        CONF[(Shared JSON Schemas + Config)]
    end

    subgraph Observability["Observability"]
        PR[Prometheus]
        GF[Grafana]
        CA[cAdvisor]
        NV[NVIDIA DCGM Exporter]
    end

    %% Planned external AI services
    subgraph AI_Plan["Planned AI Services"]
        CU[(ComfyUI Pipelines)]
        OL[(Ollama LLM)]
        TTS[(F5-TTS / GPT-SoVITS)]
        W2L[(Wav2Lip / SadTalker)]
    end

    %% Connections
    T --> UI
    T --> API
    UI <--> API

    API --> PLNR
    PLNR --> JQ
    API <--> JQ

    JQ <--> R
    R <--> WBR
    WBR <--> WEXEC
    WEXEC --> TASKS
    WEXEC --> WAPI

    TASKS --> S3

    PR --> GF
    PR <--> API
    PR <--> WAPI
    PR <--> CA
    PR <--> NV

    %% Planned integrations (not fully wired yet)
    PLNR -. future .-> OL
    WEXEC -. future .-> CU
    WEXEC -. future .-> TTS
    WEXEC -. future .-> W2L
    CU -. artifacts .-> S3
    TTS -. models .-> S3
```

**Current implementation status:**

- Fully implemented:
  - Fastify HTTP API and WebSocket hub.
  - Planner and control-plane executor.
  - Redis-backed JobQueue and worker Redis Bridge.
  - Python worker executor and task registry.
  - MinIO integration for dummy artifacts.
  - Shared JSON schemas and codegen for validators/models.
  - Metrics endpoints for backend and worker.
- Partially implemented / stubbed:
  - Script generation via LLM (`script.generateScript`).
  - GPU-specific workloads (`train_lora`, `train_voice`, `render_video`) — simulated but wired.
  - Artifact handling, beyond dummy uploads.
- Planned:
  - Real LLM integration via Ollama.
  - ComfyUI workflows for diffusion/video pipelines.
  - TTS + lip-sync models and end-to-end video generation graphs.
  - Richer agentic planner based on capabilities.

## 2) Dual‑Plane LangGraph Execution

**Description:**  
MySpinBot uses a dual-plane LangGraph orchestration model:

- A **LangGraph graph JSON** represents each job, including both control-plane and data-plane nodes.
- The **control plane** executes `plane: "node"` nodes (e.g. script generation, manifest merging).
- The **data plane** executes `plane: "python"` nodes (e.g. `train_lora`, `train_voice`, `render_video`) and hands updated graphs back to the control plane.

**Execution Loop (Control ↔ Data)**

```mermaid
sequenceDiagram
    autonumber
    participant UI as Next.js UI
    participant API as Fastify API
    participant PL as Planner (Node)
    participant CQ as Control Stream (Redis)
    participant CE as Control Executor
    participant DQ as Data Stream (Redis)
    participant WE as Worker Executor (Python)
    participant TK as Python Tasks

    UI->>API: POST /api/train
    API->>PL: build graph (script → train_lora …)
    PL-->>API: graph JSON (langgraph.v1)
    API->>CQ: enqueue control job (XADD)

    CE->>CQ: read pending graph
    CE->>CE: execute control-plane nodes
    CE->>DQ: if python nodes remain → XADD to data stream

    WE->>DQ: read python-plane job
    WE->>TK: run python-plane node(s)
    TK-->>WE: progress callbacks, artifact URIs
    WE->>CQ: if control nodes remain → enqueue updated graph
    WE-->>CQ: else publish completed/failed status

    CE->>CQ: resume control-plane nodes (if any)
    CE-->>API: final graph status
    API-->>UI: status via WebSocket (mirrored from Redis)
```

Key properties:

- **Graphs as contract** – nodes, plane assignments, and outputs all live in the graph.
- **Redis Streams + Pub/Sub** – form the control/data bridge and carry status/progress.
- **Idempotent executors** – both planes can resume partially completed graphs.

## 3) Training & Capabilities Workflows

### 3.1 Default Training Workflow

The primary entrypoint is `POST /api/train`, which builds a default LangGraph via the Planner:

- **Control-plane nodes** (Node.js):
  - `script.generateScript` — stubbed script generator (future Ollama call).
  - `script.postProcess` (conceptual) — space for post-script transformations.
- **Data-plane nodes** (Python):
  - `train_lora` — simulates LoRA training and uploads a dummy artifact to MinIO.
  - `train_voice` — placeholder for voice fine-tuning.
  - `render_video` — simulates a render and uploads a dummy video artifact.

Conceptually:

```mermaid
flowchart TD
    A[User POST /api/train] --> B["Planner (control plane)"]
    B --> C["Node LangGraph: script.generateScript"]
    C --> D["Python LangGraph: train_lora"]
    D --> E["Python LangGraph: render_video"]
    E --> F[Job completed + artifacts recorded]
```

The graph shape is intentionally generic so a future agentic planner can synthesize richer graphs from prompts and capability manifests.

### 3.2 Capabilities Workflow

`GET /api/capabilities` runs as a small hybrid graph:

1. Python node `get_capabilities` — returns the worker capability manifest.
2. Node node `capabilities.getManifest` — merges worker and control-plane capabilities into a single JSON object.

This is the first concrete dual-plane workflow; additional features are expected to follow the same pattern.

## 4) Shared Schemas, Job State & WebSockets

The system is **schema-driven**:

- Canonical JSON Schemas under `common/config/schemas/**` define:
  - LangGraph graph format.
  - Job messaging and status.
  - Redis bridge configuration.
  - Capability manifests.
- Backend: generated **AJV validators** enforce graph and config correctness.
- Worker: generated **Pydantic models** enforce the same contracts.

**Job State & WebSocket Flow**

```mermaid
flowchart LR
    U[Next.js Client] -->|POST /api/train| A[Fastify API]
    A --> B[JobQueue<br/>persist job:* in Redis]
    B <--> F[Control Executor]
    B <--> C[Redis Streams & Pub/Sub]
    C <--> R["Redis Bridge (Worker)"]
    R <--> D[Worker Executor]
    C --> B
    B -->|poll job state| E[WebSocket Hub]
    E -->|"{type:'update', ...}"| U
```

- The JobQueue mirrors worker Pub/Sub events into `job:<id>` keys.
- The WebSocket hub polls the JobQueue at `configuration.websocket.updateInterval` and pushes consolidated state to subscribers.
- Clients subscribe/unsubscribe per `jobId` and stop listening when the job reaches a terminal state.

## 5) Planned Video Generation Pipelines

The long-term goal is an end-to-end, local video generation pipeline that combines LLM planning, diffusion/video models, TTS, and lip-sync. Two main variants are planned.

### 5.1 SVD + Wav2Lip

_(“Scene → Video → Speech → Lip Sync”)_

**Idea:** A local LLM (via Ollama) generates a stage description and narrative; ComfyUI and Stable Video Diffusion create the video; TTS and Wav2Lip synchronize speech and lip motion; ESRGAN and ffmpeg polish the final MP4.

```mermaid
flowchart TD
    A[User Prompt or Caption] --> B[Node API]
    B --> C[LangGraph - Node + Ollama LLM]
    C --> |Stage Description| D[ComfyUI TTI with LoRA]
    D --> E[SVD - Stable Video Diffusion]
    C --> |Narrative| F[TTS Synthesis F5-TTS/GPT-SoVITS]
    E --> H[Wav2Lip Lip-Sync]
    F --> H
    H --> I[ESRGAN Upscale]
    I --> J[Remux → Final MP4]
    J --> K[(MinIO Storage)]
    K --> L[Frontend Playback]
```

### 5.2 SadTalker Path

_(“Portrait → Talking Head → Speech Sync”)_

**Idea:** SadTalker animates a portrait directly from synthesized speech, bypassing SVD + Wav2Lip. The LLM still produces a narrative; ComfyUI prepares imagery where needed.

```mermaid
flowchart TD
    A[User Prompt or Caption] --> B[Node API]
    B --> C[LangGraph - Node + Ollama LLM]
    C --> |Stage Description| D[ComfyUI TTI with LoRA]
    C --> |Narrative| E[TTS Synthesis F5-TTS/GPT-SoVITS]
    D --> F[SadTalker Talking-Head Animation]
    E --> F
    F --> G[ESRGAN Upscale]
    G --> H[Remux → Final MP4]
    H --> I[MinIO Storage]
    I --> J[Frontend Playback]
```

These pipelines are intentionally modular so components can be swapped (e.g., different diffusion or TTS models) without changing the overall orchestration.

## 6) User Interaction & States

Users primarily:

- Trigger training jobs.
- (In the future) generate videos from prompts or captions.
- Monitor job progress via the Web UI.

**UI / State Flow**

```mermaid
stateDiagram-v2
    [*] --> Home

    %% Training branch
    Home --> TrainProfile : Upload images/audio
    TrainProfile --> Queued : Submit
    Queued --> Training : Control plane emits job → Redis Streams
    Training --> Trained : Data plane finishes, artifacts saved
    Training --> Failed : Error
    Failed --> Queued : Retry

    %% Generation branch (planned)
    Home --> Generate : Enter topic/caption
    Generate --> Generating : Orchestrate video pipeline
    Generating --> Reviewing : MP4 ready
    Reviewing --> [*]
    Generating --> FailedGen : Error
    FailedGen --> Generating : Retry
```

**Notes on Extensibility**

- Model swaps: ComfyUI and TTS blocks are parameterized to allow model changes without altering orchestration.
- Scalability: Multiple worker replicas can consume from the same Redis Streams, scaling the data plane independently.
- Security: Traefik and optional auth layers can front management UIs (Open WebUI, Grafana, etc.).
- Observability: Both planes expose `/metrics`; higher-level job and node metrics can be added incrementally.

