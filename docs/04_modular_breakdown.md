# Modular Breakdown & Technical Analysis

This section explains the internal composition of the MySpinBot system, detailing each subsystem, its responsibilities, interfaces, and extensibility points. It reflects the current implementation and its modular structure; for how the design evolved across phases, see [history](./06_history.md).

## 1. Overview: Modular Composition

At a high level, the repository is organized around its four primary core components and their supporting infrastructure:

| Module                  | Location        | Primary Language | Responsibility                                                                                              | Key Interfaces                                                             |
| :---------------------- | :------------- | :--------------- | :---------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| **Frontend (Next.js)**  | `frontend/`    | TypeScript       | User-facing UI for triggering generation/training jobs, monitoring jobs progress, and inspecting artifacts.           | REST (HTTP, JSON), WebSocket for real-time job updates                     |
| **Backend (Control)**   | `backend/`     | JavaScript       | Fastify API + WebSocket hub, Planner, control-plane LangGraph executor, Redis bridge, metrics.            | REST, Redis Streams & Pub/Sub, LangGraph.js API                            |
| **Worker (Data Plane)** | `worker/`      | Python           | FastAPI service, Redis bridge, data-plane LangGraph executor, tasks registry, tasks implementations, MinIO artifact handling.     | Redis Streams & Pub/Sub, FastAPI `/metrics`, MinIO/S3 client               |
| **Shared Schemas**      | `common/`      | JSON / Scripts   | Canonical JSON Schemas, baseline config, and codegen scripts for validators/models used by both planes.   | Filesystem (`common/config/**`), codegen scripts                            |
| **Infrastructure**      | `infra/` + root| YAML / Docker    | Traefik, Redis, PostgreSQL, MinIO, Ollama, ComfyUI, Prometheus, Grafana, OpenWebUI, Redis Insight, pgAdmin, Dev Containers, and Docker Compose definitions.| Traefik HTTP/TLS, Prometheus `/metrics`, Docker networking and volumes     |

## 2. Deployment Topology

There are two deployment modes one for production and one for development. Below are the details.

### 2.1 Docker Compose Topology (Production vs Development)

The production deployment uses `docker-compose.yml` and runs:

- **Core app services**: `api` (control-plane backend), `ui` (frontend), `worker` (data-plane backend).
- **Core infrastructure services**: Traefik, Redis, PostgreSQL, MinIO, Redis Insight, pgAdmin
- **Core AI services**: Ollama, ComfyUI, OpenWebUI (up via `chatbot` profile)
- **Observability services** (up via `observability` profile): Prometheus, Grafana, Redis Exporter, cAdvisor, DCGM exporter
- **Utility services**: `codegen` (up via `schemas` profile), `downloader`.

The development deployment overlays `docker-compose.dev.yml` on top of the production one (services are overriden).

- **Dev app containers**
  - `api`, `ui`, and `worker` have `*-dev` images, open interactive shells, and mount local source directories for live editing.
  - Dev container feature isolated sandboxes for safely deploy coding agents.
  - Processes management (start/stop) is manual.
  - Debug ports are exposed (`9229` for backend, `9230` for frontend, `5678` for worker) while still connecting to the same Redis, MinIO, Postgres services as defined in `docker-compose.yml`.
- **Sandbox container**: A `sandbox` service provides a generic development shell with the entire repository mounted at `/workspace` for ad-hoc scripts and experiments.
- **Shared infra**: All other services including (optionally) observability ones the base `docker-compose.yml` and are reused unchanged in development.

This arrangement keeps the **app layer mutable** (hot-reload, debugging, test runs) while the **infra layer** remains stable and close to the production topology.

## 2.2 Compose Profiles

#### Default profile

`docker compose up -d` or `docker compose -f ./docker-compose.yml up -d`

```mermaid
flowchart TB
    subgraph PublicNetwork["HTTPS (:443)"]
      Proxy["myspinbot-proxy (Traefik)"]
    end
    subgraph ApplicationServices[Application Services]
      UI["myspinbot-frontend (Next.js/React)"]
      API["myspinbot-backend (Node.js/Fastify)"]
      Worker["myspinbot-worker (Python/PyTorch/CUDA)"]
    end
    subgraph StorageServices["Cache/Persistence Services"]
      S3[("myspinbot-minio (MinIO/S3)")]
      Redis[("myspinbot-redis (Redis/Streams/PubSub)")]
      Postgres[("myspinbot-postgres (PostgreSQL/pgvector)")]
    end
    subgraph ManagementServices["Management Services"]
      RedisInsight["myspinbot-redis-insight (Redis Insight GUI)"]
      Pgadmin["myspinbot-pgAdmin (pgAdmin GUI)"]
    end
    subgraph AIServices["AI Services"]
      subgraph AIUtilities["Utilities"]
        Downloader["myspinbot-downloader (Data staging sidecar)"]
      end
      Ollama["myspinbot-ollama (Ollama Server)"]
      Comfy["myspinbot-comfyui (ComfyUI/CUDA)"]
    end

    Downloader -- Volume --- Ollama
    Downloader -- Volume --- Comfy
    Proxy -- Network --- Comfy
    Proxy -- Network --- UI
    Proxy -- Network --- API
    Proxy -- Network --- S3
    Proxy -- Network --- RedisInsight
    Proxy -- Network --- Pgadmin
    RedisInsight -- Network --- Redis
    Pgadmin -- Network --- Postgres
    UI -- Network --- API
    API -- Network --- Redis
    API -- Network --- S3
    API -- Network --- Ollama
    Worker -- Volume --- Comfy
    Worker -- Network --- Redis
    Worker -- Network --- S3
```

### `observability` profile

`docker compose -f ./docker-compose.yml --profiles observability up -d`

```mermaid
flowchart TB
    subgraph PublicNetwork["HTTPS (:443)"]
      Proxy["myspinbot-proxy (Traefik)"]
    end
    subgraph ApplicationServices[Application Services]
      API["myspinbot-backend (Node.js/Fastify)"]
      Worker["myspinbot-worker (Python/PyTorch/CUDA)"]
    end
    subgraph StorageServices["Cache/Persistence Services"]
      Redis[("myspinbot-redis (Redis/Streams/PubSub)")]
    end
    subgraph ManagementServices["Management Services"]
      Grafana["myspinbot-grafana (Grafana GUI)"]
    end
    subgraph ObservabilityServices[Observability Services]
      direction BT
      Prometheus["myspinbot-prometheus (Prometheus)"]
      RedisExporter["myspinbot-redis-exporter (Redis Exporter)"]
      cAdvisor["myspinbot-cadvisor (Docker Exporter)"]
      DCGMExporter["myspinbot-dcgm-exporter (NVIDIA DCGM Exporter)"]
    end

    Proxy -- Network --- Grafana
    Prometheus -- Network --- Grafana
    Redis -- Network --- RedisExporter
    RedisExporter -- Network --- Prometheus
    cAdvisor -- Network --- Prometheus
    DCGMExporter -- Network --- Prometheus
    Proxy -- Network --- Prometheus
    API -- Network --- Prometheus
    Worker -- Network --- Prometheus

    PublicNetwork ~~~ ManagementServices
    ManagementServices ~~~ ObservabilityServices
    ObservabilityServices ~~~ ApplicationServices
    ApplicationServices ~~~ StorageServices
```

#### `chatbot` profile

```mermaid
flowchart BT
    subgraph PublicNetwork["HTTPS (:443)"]
      Proxy["myspinbot-proxy (Traefik)"]
    end
    subgraph ManagementServices["Management Services"]
      OpenWebUI["myspinbot-openwebui (OpenWebUI)"]
    end
    subgraph AIServices["AI Services"]
      Ollama["myspinbot-ollama (Ollama Server)"]
    end

    Ollama -- Network --- OpenWebUI
    OpenWebUI -- Network --- Proxy
```

#### `schemas` profile (development)

`docker compose -f ./docker-compose.yml -f ./docker-compose.dev.yml --profiles schemas up -d`

```mermaid
flowchart LR
    subgraph ApplicationServices[Application Services]
      subgraph ApplicationUtilities["Utilities"]
        CodeGen["myspinbot-codegen (Data Model Generator)"]
      end
      API["myspinbot-backend (Node.js/Fastify)"]
      Worker["myspinbot-worker (Python/PyTorch/CUDA)"]
    end
    subgraph RestInfra1["..."]
        Rest1[...]
    end
    subgraph RestInfra2["..."]
        Rest2[...]
    end
    RestInfra1 --- ApplicationServices
    ApplicationServices --- RestInfra2
    CodeGen -- Mapped Directory --> API
    CodeGen -- Mapped Directory --> Worker
```

#### `monorepo` profile (development)

`docker compose -f ./docker-compose.yml -f ./docker-compose.dev.yml --profiles monorepo up -d`

```mermaid
graph LR
    subgraph BaseInfra[Infrastructure Services]
        direction RL
        T[Traefik Proxy]
        Rest[...]
    end

    subgraph ApplicationServices["Application Services (dev)"]
        API_DEV["myspinbot-backend:dev (Mounted Source, Debug Port, Manual Start/Stop)"]
        UI_DEV["myspinbot-frontent:dev (Mounted Source, Debug Port, Manual Start/Stop)"]
        WORKER_DEV["myspinbot-worker:dev (Mounted Source, Debug Port, Manual Start/Stop)"]
        COMFYUI_DEV["myspinbot-comfyui:dev (Mounted Source, Debug Port, Manual Start/Stop)"]
        SANDBOX["Sandbox"]
    end


    API_DEV <--> BaseInfra
    UI_DEV <--> BaseInfra
    COMFYUI_DEV <--> BaseInfra
    WORKER_DEV <--> BaseInfra

    SANDBOX["myspinbot-sandbox"]

    SANDBOX -- Src Access --> API_DEV
    SANDBOX -- Src Access --> UI_DEV
    SANDBOX -- Src Access --> WORKER_DEV
    SANDBOX -- Src Access --> COMFYUI_DEV

    User["Developer"]

    User -- Dev Container (VS Code) --> SANDBOX
    User -- Dev Container (VS Code) --> API_DEV
    User -- Dev Container (VS Code) --> UI_DEV
    User -- Dev Container (VS Code) --> WORKER_DEV
    User -- Dev Container (VS Code) --> COMFYUI_DEV
    User -- HTTPS --> T

    style UI_DEV fill:#aec,stroke:#333,stroke-width:2px
    style WORKER_DEV fill:#fcd,stroke:#333,stroke-width:2px
    style COMFYUI_DEV fill:#fcd,stroke:#333,stroke-width:2px
    style API_DEV fill:#9cf,stroke:#333,stroke-width:2px
```

**Additional topology notes:**

- **Network** – all services share the `internal-network` bridge; Traefik attaches to the same network and exposes selected HTTP endpoints via `*.${DOMAIN-myspinbot.local}` hostnames.
- **Storage** – named volumes are used for:
  - Redis data (`redis-data`)
  - Redis Insight configuration (`redis-insight-data`)
  - MinIO buckets (`minio-data`)
  - PostgreSQL data (`postgres-data`)
  - Ollama data (`ollama-data`) - This is where LLMs go
  - OpenWebUI configuration (`openwebui-data`)
  - ComfyUI data (`comfyui-data`) - This is where diffusion models go
- **GPU access** – the `worker` service reserves all NVIDIA devices (`gpus: all`) and is monitored by the DCGM exporter; other services are CPU-only.
- **Profiles** – observability-related services (Prometheus, Grafana, exporters) run under the `observability` profile; the `codegen` service runs on demand under the `schemas` profile.

## 3) Backend (Control Plane) — `backend/`

The Node.js backend (`myspinbot-backend`) is also the **control plane**: it owns HTTP/WS APIs, builds LangGraph jobs, executes control-plane nodes, and mirrors worker progress into WebSocket updates.

### 2.1 Internal Structure

Typical layout (details may evolve, but these are the current conceptual modules):

```text
backend/
├─ src/
│  ├─ index.js                 # Fastify bootstrap, CORS, route registration
│  ├─ config.js                # Load + validate configuration, capabilities
│  ├─ api/
│  │  ├─ http/                 # HTTP route handlers 
│  │  └─ ws/                   # WebSocket route wiring
│  ├─ core/                    # Core backend facilities
│  │  ├─ executor.js           # LangGraph executor
│  │  ├─ job-queue.js          # Redis Streams + Pub/Sub wrapper for Jobs
│  │  ├─ job-repository.js     # Persistence layer for Jobs
│  │  ├─ pipelines.js          # Fixed pipelines definitions
│  │  └─ planner.js            # LangGraph template builder + graph validation
│  ├─ infra/                   # Control-plane infrastructure facilities
│  │  ├─ database.js           # Database layer over pg pool
│  │  ├─ metrics.js            # Telemetry layer over Prometheus client (prom-client)
│  │  ├─ minio.js              # Object store layer over minio client
│  │  └─ websocket.js          # WebSockets server
│  ├─ services/                # Control-plane services
│  │  ├─ artifacts.js          # Artifacts management services
│  │  └─ storage.js            # WebSockets server
│  └─ validators/              # AJV validators (generated from common schemas)
└─ tests/                      # Vitest test suite
```

### 2.2 Responsibilities

- **Fastify API / WebSocket**
  - Routes: `/health`, `/metrics`, `/api/capabilities`, `/api/status/:jobId`, `/api/train`, `/ws`.
  - WebSocket hub supports `SUBSCRIBE` / `UNSUBSCRIBE` per `jobId`.
- **Configuration Layer**
  - `config.js` merges multiple JSON config files (including Redis bridge) and validates everything using generated AJV validators.
  - Exposes helpers like `getConfiguration()` and `getCapabilities()`.
- **JobQueue**
  - Wraps a single Redis instance using `ioredis`.
  - Owns Streams for control/data processing (`${streams.process}:control` / `:data`).
  - Persists job state in `job:<id>` keys (status, progress, last graph).
  - Subscribes to worker Pub/Sub channels and mirrors state into Redis keys and WebSocket metrics.
- **Planner**
  - Assembles default LangGraph templates for `/api/train` and internal flows.
  - Validates graph JSON using a generated `graph.schema-validator` from `common/`.
  - Ensures metadata consistency (e.g. `workflowId` matches `jobId`, valid `plane` values).
- **Control Executor**
  - Polls the control stream for pending graphs.
  - Executes all `plane: "node"` nodes via a service registry (`services/*.js`).
  - Updates node status/output, recomputes progress, and persists the updated graph.
  - Hands off to the data stream when python-plane nodes remain; otherwise finalizes and publishes status.
- **Services Registry**
  - Dynamically loads services such as:
    - `script.generateScript` — stubbed script generation.
    - `capabilities.getManifest` — merges control and worker capability manifests.
    - `artifacts.uploadArtifact` / `prepareAssets` — stubs for future MinIO integration.

## 4) Worker (Data Plane) — `worker/`

The worker is the **data plane**: it executes python-plane LangGraph nodes, simulates GPU work, writes artifacts to MinIO, and exposes metrics via FastAPI.

### 3.1 Internal Structure

```text
worker/
├─ src/worker/
│  ├─ main.py                 # FastAPI app, lifespan, /health, /metrics
│  ├─ config.py               # WorkerConfiguration (Pydantic), capabilities loader
│  ├─ core/
│  │  ├─ bridge.py            # Redis Streams + Pub/Sub bridge (data plane)
│  │  └─ executor.py          # Python-plane LangGraph executor
│  ├─ services/
│  │  └─ tasks.py             # Task registry (train_lora, train_voice, render_video, get_capabilities)
│  ├─ models/                 # Generated Pydantic models (LangGraph, jobs, capabilities, redis, storage)
│  └─ infra/
│     └─ metrics/             # Prometheus metrics helpers
└─ tests/                     # pytest test suite
```

### 3.2 Responsibilities

- **FastAPI App**
  - Provides `/health` and `/metrics` endpoints.
  - Startup lifespan connects to Redis and starts the executor loop.
- **Configuration**
  - `config.py` merges JSON config and environment variables into a `WorkerConfiguration` singleton (Pydantic).
  - Loads `config/capabilities.json` to advertise worker abilities (`train_lora`, `render_video`, etc.).
- **Redis Bridge**
  - Mirrors the behavior of the backend JobQueue on the data plane:
    - Consumes from `${streams.process}:data`.
    - Acknowledges entries and persists job payloads with TTL.
    - Can enqueue updated graphs back to the control stream.
    - Publishes `status:*`, `progress:*`, and `data:*` messages via Pub/Sub.
- **Python Executor**
  - Polls the bridge for pending jobs.
  - Validates graph payload using generated Pydantic models (e.g. `LangGraphGraph`).
  - Executes `plane: "python"` nodes in dependency order.
  - Each node handler receives typed params, input context, and callbacks for progress/data emission.
  - Records per-node and per-job metrics (e.g. `gpu_worker_jobs_total`, `gpu_worker_job_duration_seconds`).
- **Task Registry (`services/tasks.py`)**
  - Decorated with `@task` to register handlers:
    - `train_lora` — simulates LoRA training, uploads a dummy `.safetensors` artifact to MinIO.
    - `train_voice` — placeholder for voice training (stubbed).
    - `render_video` — simulates video render, uploads a dummy MP4 artifact.
    - `get_capabilities` — returns a JSON manifest string from configuration.
  - Includes helpers like `connect_minio`, `simulate_progress`, `upload_dummy_artifact`.

## 5) Shared Schemas & Codegen — `common/` + `codegen/`

The shared schema and code generation layer keeps the two planes aligned:

```text
common/
  └─ config/
      ├─ schemas/
      │   ├─ capabilities/
      │   ├─ jobs/
      │   ├─ langgraph/
      │   ├─ redis/
      │   └─ storage/
      ├─ redis.bridge.json
      └─ ...

codegen/
  ├─ gen-backend-validators.sh
  ├─ gen-worker-datamodel.sh
  └─ gen-all.sh
```

- Schemas describe graph structure, job lifecycle, capabilities, and configuration.
- Backend validators (AJV) and worker models (Pydantic v2) are generated from the same schemas.
- Both planes validate configuration and graph payloads against these canonical definitions to avoid drift.

## 6) Frontend — `frontend/`

The frontend is intentionally small and focused on **job lifecycle visualization** rather than full profile management or artifact browsing.

### 5.1 Structure

```text
frontend/
├─ app/
│  ├─ layout.tsx          # App shell, branding
│  └─ page.tsx            # Main page (upload + jobs)
├─ components/
│  ├─ UploadForm.tsx      # Image + prompt upload, calls /api/train
│  ├─ StatusCard.tsx      # Status pill + prompt + progress
│  └─ ProgressBar.tsx     # Visual progress indicator
├─ lib/
│  ├─ api.ts              # REST helpers (postTrain, status)
│  └─ ws.ts               # WebSocket hook for /ws
└─ tests/                 # Vitest + React Testing Library
```

### 5.2 Responsibilities

- Triggers training by POSTing to `/api/train`.
- Establishes a WebSocket connection to `/ws` and subscribes to specific job IDs.
- Renders a StatusCard per job with up-to-date progress and status.
- Unsubscribes once a job reaches a terminal state.

The UI is minimal but wired to the same job and progress semantics that future, richer UIs will use.

## 7) Infrastructure & Dev Workflow — `infra/` + Dev Containers

The infrastructure layer consolidates shared services and development tooling:

- **Infra stack** (`infra/` + `docker-compose*.yml`):
  - Traefik proxy, TLS, and routing.
  - Redis + Redis Insight.
  - MinIO for artifacts.
  - Prometheus + Grafana for metrics and dashboards.
  - cAdvisor + DCGM Exporter for container and GPU metrics.
- **Dev Containers**:
  - Each of `backend/`, `frontend/`, and `worker/` has its own `.devcontainer/` configuration.
  - Development happens inside these containers for parity with production images.
  - Tests (Vitest / pytest) run inside their respective Dev Containers.

From a modular standpoint, each subsystem is effectively a self-contained module with its own runtime environment, while sharing infra services via Compose.

## 8) Module Dependency Diagram

```mermaid
graph TD
    subgraph Frontend["frontend/ (Next.js)"]
        FUI[Components + lib/api.ts + lib/ws.ts]
    end

    subgraph Backend["backend/ (Control Plane)"]
        BAPI[API & WS Routes]
        BCFG[Config & Validators]
        BJQ[JobQueue]
        BPLN[Planner]
        BEX[Control Executor]
        BSVC[Services Registry]
    end

    subgraph Worker["worker/ (Data Plane)"]
        WCFG[Config & Models]
        WBR[Redis Bridge]
        WEX[Python Executor]
        WTSK[Task Registry]
    end

    subgraph Shared["common/ + codegen/"]
        SCHEMAS[JSON Schemas]
        GEN[Codegen Scripts]
    end

    FUI --> BAPI
    BAPI --> BJQ
    BJQ --> BEX
    BEX --> BSVC
    BJQ <--> WBR
    WBR --> WEX
    WEX --> WTSK

    SCHEMAS --> GEN
    GEN --> BCFG
    GEN --> WCFG
    BCFG --> BAPI
    WCFG --> WEX
```

This diagram reflects how code modules are connected today — not just conceptually, but in actual imports and runtime flows.

## 9) Planned External AI Services (Module View)

Beyond the core modules, several AI services are planned as separate, optional modules:

| Module               | Responsibility                                                | Integration Point                       |
| :------------------- | :----------------------------------------------------------- | :-------------------------------------- |
| **ComfyUI Service**  | Visual workflows for text-to-image, image-to-video, etc.     | Called from worker tasks / LangGraph.   |
| **Ollama + Open WebUI** | LLM runtime and management/chat UI for script planning.    | Called from backend LangGraph nodes.    |
| **TTS / Voice Stack** (F5-TTS, GPT-SoVITS) | Text-to-speech and voice cloning.               | Implemented as worker tasks.            |
| **Lip-sync / Talking-Head** (Wav2Lip, SadTalker) | Lip-sync or talking-head animation.           | Implemented as worker tasks.            |

These remain modular add-ons: they are not required to run the current training flows but are part of the long-term architecture and can be integrated without changing the core module boundaries described above.
