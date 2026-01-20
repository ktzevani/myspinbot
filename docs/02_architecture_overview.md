# Architecture Overview

This document describes the current MySpinBot architecture at multiple levels: a high-level component map, the dual-plane execution model, concrete training and capabilities workflows, and user interaction flows. The design has evolved through multiple planned development cycles; see `06_history.md` for a summary of that evolution.

## 1) High‑Level System Architecture

### Description  

The platform is a comprehensive, local-first AI infrastructure deployed and managed using Docker Compose. It is designed around a **dual-plane LangGraph orchestration architecture**, integrating a Node.js-based **Control Plane** (backend) with a Python/GPU-powered **Data Plane** (worker). It also includes a Next.js frontend, and shared infrastructure for storage, routing, and observability. 

The entire system is containerized, facilitating consistent environments across development and production. It includes core application services, a robust set of data stores, a full observability stack, and integrated AI inference engines (LLMs, diffusion models). A key aspect is the clear separation between a production-like deployment (`docker-compose.yml`) and a development overlay (`docker-compose.dev.yml`), allowing for efficient local development with live code reloading and debugging.

The platform's architecture is a microservices-oriented approach, where specialized services communicate over a shared internal network. Traefik acts as the ingress controller, routing external traffic to the appropriate services and handling TLS.

### Overall System Map 

**Production Environment**

The `docker-compose.yml` defines the core production-ready services.

```mermaid
graph LR
    subgraph Traefik["Ingress & Edge (Traefik)"]
        T[Traefik Proxy & TLS]
    end

    subgraph Application Services
        UI["Frontend (Next.js)"]
        API["Backend (Node.js)"]
        WORKER["Worker (Python/GPU)"]
        COMFYUI["ComfyUI (Python/GPU)"]
        OLLAMA["Ollama (LLM)"]
        OPENWEBUI["Open WebUI (Ollama GUI)"]
    end

    subgraph Data & Storage
        REDIS[(Redis - Streams, Pub/Sub, Cache)]
        POSTGRES[(PostgreSQL - Durable Job State)]
        MINIO[(MinIO - Object Storage / S3)]
        PGADMIN[pgAdmin - Postgres GUI]
        REDISINSIGHT[Redis Insight - Redis GUI]
    end

    subgraph Observability["Observability (Profile: observability)"]
        PROM[Prometheus - Metrics Collection]
        GRAFANA[Grafana - Dashboards]
        CADVISOR[cAdvisor - Container Metrics]
        DCGM[NVIDIA DCGM Exporter - GPU Metrics]
        REDIS_EXP[Redis Exporter]
    end

    subgraph Utility Services
        DOWNLOADER[Downloader - AI Model Fetcher]
        CODEGEN[Codegen - Schema Generators]
    end

    User --> T
    T --> UI
    T --> API
    T --> GRAFANA
    T --> REDISINSIGHT
    T --> PGADMIN
    T --> MINIO
    T --> OPENWEBUI
    T --> COMFYUI

    UI <--> API
    API <--> REDIS
    API <--> POSTGRES
    API <--> MINIO
    API <--> OLLAMA

    REDIS <--> WORKER
    MINIO <--> WORKER
    COMFYUI <--> WORKER
    OLLAMA <--> OPENWEBUI

    PROM --> GRAFANA
    PROM -- Scrapes --> T
    PROM -- Scrapes --> API
    PROM -- Scrapes --> WORKER
    PROM -- Scrapes --> REDIS_EXP
    PROM -- Scrapes --> MINIO
    PROM -- Scrapes --> CADVISOR
    PROM -- Scrapes --> DCGM

    DOWNLOADER -- Downloads Models --> OLLAMA
    DOWNLOADER -- Downloads Models --> COMFYUI

    CODEGEN -- Generates Schemas --> API
    CODEGEN -- Generates Models --> WORKER

    style WORKER fill:#f9f,stroke:#333,stroke-width:2px
    style API fill:#9cf,stroke:#333,stroke-width:2px
```

**Development Environment (Overlay)**

The `docker-compose.dev.yml` overlays `docker-compose.yml` to enable a developer-friendly environment. It replaces production application images with development-specific images that mount local source code, expose debugging ports, and provide interactive shells.

```mermaid
graph RL
    subgraph Base Infra
        T[Traefik]
        REDIS[(Redis)]
        POSTGRES[(PostgreSQL)]
        MINIO[(MinIO)]
        PROM[Prometheus]
        GRAFANA[Grafana]
        OLLAMA[Ollama]
        OPENWEBUI[Open WebUI]
        COMFYUI[ComfyUI]
    end

    subgraph Development Services
        API_DEV["Backend:dev (Mounted Source, Debug)"]
        UI_DEV["Frontend:dev (Mounted Source, Debug)"]
        WORKER_DEV["Worker:dev (Mounted Source, Debug)"]
        COMFYUI_DEV["ComfyUI:dev (Mounted Source, Debug)"]
        SANDBOX["Sandbox (Entire Workspace)"]
    end

    T --- HTTP/WS --- API_DEV
    T --- HTTP --- UI_DEV
    API_DEV <--> REDIS
    API_DEV <--> POSTGRES
    API_DEV <--> MINIO
    API_DEV <--> OLLAMA

    REDIS <--> WORKER_DEV
    MINIO <--> WORKER_DEV
    COMFYUI <--> WORKER_DEV
    OLLAMA <--> OPENWEBUI

    SANDBOX -- Accesses --> API_DEV
    SANDBOX -- Accesses --> UI_DEV
    SANDBOX -- Accesses --> WORKER_DEV
    SANDBOX -- Accesses --> COMFYUI_DEV

    style API_DEV fill:#ace,stroke:#333,stroke-width:2px
    style UI_DEV fill:#aec,stroke:#333,stroke-width:2px
    style WORKER_DEV fill:#fce,stroke:#333,stroke-width:2px
    style COMFYUI_DEV fill:#fcd,stroke:#333,stroke-width:2px
```

### Docker Profiles

Docker Compose profiles are used to conditionally start groups of services, optimizing resource usage and allowing for flexible deployments.

*   **Default (no profile specified):** Starts core application services (Traefik, Redis, Postgres, MinIO, `api`, `ui`, `worker`) along with core AI services offering inference capabilities (including Ollama and ComfyUI), ensuring a functional and complete AI stack.
*   **`observability`:** Includes Prometheus, Grafana, cAdvisor, DCGM Exporter, and Redis Exporter for comprehensive monitoring.
*   **`chatbot`:** Activates Open WebUI facility for managing llm models and providing prompting facilities.
*   **`schemas`:** Activates the `codegen` service for generating validation schemas and data models.
*   **`monorepo`:** Activates the `sandbox` container in development mode, providing a general-purpose environment with the entire monorepo mounted.

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

## 3) Shared Schemas, Job State & WebSockets

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

## 4) Custom & Capabilities Workflows

### 4.1 InfiniteTalk Workflow

The entrypoint is `POST /api/infinitetalk`, which builds a workflow LangGraph via the Planner:

- **Control-plane nodes** (Node.js):
  - `script.generateScript` — prompts appointend llm in ollama to generate narration structure.
- **Data-plane nodes** (Python):
  - `f5_to_tts` — converts the generated script text into a realistic speech audio file.
  - `infinite_talk` —takes a source image and the audio file from the previous step and creates an animated talking-head video.
  - `upscale_video` — processes the video to upscale it via AI upscaling and to restore and enhance facial details.

For more details please read [InfiniteTalk Deep Dive](phase3/infinite_talk.md) 

### 4.2 Capabilities Workflow

`GET /api/capabilities` runs as a small hybrid graph:

1. Python node `get_capabilities` — returns the worker capability manifest.
2. Node node `capabilities.getManifest` — merges worker and control-plane capabilities into a single JSON object.

This is the first concrete dual-plane workflow; additional features are expected to follow the same pattern.


## 5) Planned Video Generation Pipelines

The long-term goal is to provide more end-to-end, local video generation pipelines that combine LLM planning, diffusion/video models, TTS, lip-sync facilities and more. 

Other than the implemented InfiniteTalk pipeline there are two other variants planned. One of which (SVD+Wav2Lip) includes training a character-specific LoRA (given a set of images as an input) to apply ontop of the video generation diffusion model. While both planned pipelines introduce the generation of novel character portrait images (in contrast to the user providing one, like in InfiniteTalk workflow) with their surrounding environment out of the descriptions that the llm provides.  

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

- Trigger generation pipelines.
- Monitor job progress via the Web UI.
- (In the future) manage generated artifacts and browser through jobs history.

**UI / State Flow**

![alt text](resources/image.png)

```mermaid
stateDiagram-v2
    User --> FileDialog1 : upload portrait
    User --> FileDialog2 : upload voice sample
    User --> TextInput1 : voice reference text
    User --> TextInput2 : prompt 
    TextInput1 --> Generate : submit 
    TextInput2 --> Generate : submit 
    FileDialog1 --> Generate : submit 
    FileDialog2 --> Generate : submit 
    Generate --> ProgressUpdate : queue/process job
    ProgressUpdate --> VideoPreview : status updates
```

**Notes on Extensibility**

- Model swaps: ComfyUI and TTS blocks are parameterized to allow model changes without altering orchestration.
- Scalability: Multiple worker replicas can consume from the same Redis Streams, scaling the data plane independently.
- Security: Traefik and optional auth layers can front management UIs (Open WebUI, Grafana, etc.).
- Observability: Both planes expose `/metrics`; higher-level job and node metrics can be added incrementally.

