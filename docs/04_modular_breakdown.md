# 🧱➜🧱 Modular Breakdown & Technical Analysis

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

    Proxy -- Network --- Comfy
    Proxy -- Network --- UI
    Proxy -- Network --- API
    Proxy -- Network --- S3
    Proxy -- Network --- RedisInsight
    Proxy -- Network --- Pgadmin
    Downloader -- Volume --- Ollama
    Downloader -- Volume --- Comfy
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
    Proxy -- Network --- Prometheus

    Prometheus -- Network --- Grafana
    Redis -- Network --- RedisExporter
    RedisExporter -- Network --- Prometheus
    cAdvisor -- Network --- Prometheus
    DCGMExporter -- Network --- Prometheus
    API -- Network --- Prometheus
    Worker -- Network --- Prometheus

    PublicNetwork ~~~ ManagementServices
    ManagementServices ~~~ ObservabilityServices
    ObservabilityServices ~~~ ApplicationServices
    ApplicationServices ~~~ StorageServices
```

#### `chatbot` profile

`docker compose -f ./docker-compose.yml --profiles chatbot up -d`

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

    OpenWebUI -- Network --- Proxy
    Ollama -- Network --- OpenWebUI
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

## 3. Backend (Control Plane) — `backend/`

The Node.js backend (`myspinbot-backend`) is also the **control plane**: it owns HTTP/WS APIs, builds LangGraph jobs, executes control-plane nodes, and mirrors worker progress into WebSocket updates.

### 3.1 Internal Structure

Typical layout (details may evolve, but these are the current conceptual modules):

```text
backend/
├─ src/
│  ├─ api/                     # Backend API
│  │  ├─ http/                 # HTTP route handlers 
│  │  │  │  *-controller.js    # Controllers definition
│  │  │  └─ routes.js          # Central endpoint registration (routes-controllers mapping) facility
│  │  └─ ws/                   # WebSocket route wiring
│  │     |  ws-controller.js   # WebSocket controller definition
│  │     └─ routes.js          # WebSocket endpoint registration
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
│  ├─ model/                   # Data models
│  ├─ services/                # Control-plane services
│  │  ├─ artifacts.js          # Artifacts management services
│  │  ├─ capabilities.js       # Capabilities advertising service
│  │  ├─ registry.js           # Internal services registry
│  │  └─ script.js             # Narration script generation services
│  ├─ validators/              # AJV validators (generated from common schemas)
│  ├─ config.js                # Load + validate configuration, capabilities
│  └─ index.js                 # Fastify bootstrap, CORS, route registration
└─ tests/                      # Vitest test suite
```

### 3.2 Responsibilities

- **Fastify API / WebSocket**
  - Routes: `/health`, `/metrics`, `/api/capabilities`, `/api/status/:jobId`, `/api/infinitetalk`, `/ws`.
  - WebSocket hub supports `SUBSCRIBE` / `UNSUBSCRIBE` per `jobId`.
- **Configuration Layer**
  - `config.js` merges multiple JSON config files (including Redis bridge) and validates everything using generated AJV validators.
  - Exposes helpers like `getConfiguration()` and `getCapabilities()`.
- **JobQueue**
  - Wraps a single Redis instance using `ioredis`.
  - Owns Streams for control/data processing (`${streams.process}:control` / `:data`).
  - Persists job state in `job:<id>` keys (status, progress, last graph).
  - Subscribes to worker Pub/Sub channels and mirrors state into Redis keys and WebSocket metrics.
- **Pipelines**
  - Assembles fixed LangGraph templates for public custom (e.g. `/api/infinitetalk`) and internal workflows (e.g. `/api/capabilities`).
- **Planner**
  - Validates graph JSON using a generated `graph.schema-validator` from `common/`.
  - Ensures metadata consistency (e.g. `workflowId` matches `jobId`, valid `plane` values).
- **Control Executor**
  - Polls the control stream for pending graphs.
  - Executes all `plane: "node"` nodes via a service registry (`services/*.js`).
  - Updates node status/output, recomputes progress, and persists the updated graph.
  - Hands off to the data stream when python-plane nodes remain; otherwise finalizes and publishes status.
- **Services Registry**
  - Dynamically loads services (tasks) such as:
    - `script.generateScript` — stubbed script generation.
    - `capabilities.getManifest` — merges control and worker capability manifests.
    - `artifacts.uploadArtifact` / `prepareAssets` — stubs for future MinIO integration.

## 4. Worker (Data Plane) — `worker/`

The worker is the **data plane**: it processes python-plane LangGraph nodes, executes GPU work, writes artifacts to MinIO, and exposes metrics via FastAPI.

### 4.1 Internal Structure

```text
worker/
├─ src/worker/
│  ├─ api/                     # Public API
│  │  ├─ endpoints/            # Controllers
│  │  └─ router.py             # Central enpoint registration (routes-controllers mapping) facility
│  ├─ core/                    # Core worker facilities
│  │  ├─ bridge.py             # Redis Streams + Pub/Sub bridge (data plane)
│  │  └─ executor.py           # Python-plane LangGraph executor
│  ├─ infra/                   # Data-plane infrastructure facilities
│  │  └─ metrics/              # Telemetry layer over Prometheus client
│  ├─ models/                  # Generated Pydantic models 
│  ├─ services/                # Data-plane services
│  │  ├─ storage.py            # Artifacts management helpers
│  │  └─ tasks.py              # Tasks definitions
│  ├─ utils/                   # Misc helpers
│  ├─ workflows/               # Diffusion workflow components
│  │  ├─ infinitetalk.py       # InfiniteTalk pipeline implementation 
│  │  ├─ tts.py                # Text-to-Speech pipeline implementation
│  │  └─ upscaler.py           # AI upscaling implementation
│  ├─ config.py                # WorkerConfiguration (Pydantic), capabilities loader
│  └─ main.py                  # FastAPI app, lifespan control loop, router registration
└─ tests/                      # pytest test suite
```

### 4.2 Responsibilities

- **FastAPI App**
  - Provides `/health` and `/metrics` endpoints.
  - lifespan context manager connects to Redis and starts the executor loop.
- **Configuration**
  - `config.py` merges JSON config and environment variables into a `WorkerConfiguration` singleton (Pydantic).
  - Loads `config/capabilities.json` to advertise worker services (`f5_to_tts`, `infinite_talk`, etc.).
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
    - `dummy_task` — placeholder task for compiling dummy workflows
    - `f5_to_tts` — text to speech with F5TTS_v1_Base model
    - `infinite_talk` — infinite talk image+audio to video diffusion pipeline (wan 2.1)
    - `upscale_video` — ai upscaling pipeline (RealESRGAN and codeformer)
    - `get_capabilities` — returns a JSON manifest string from configuration.

## 5. Shared Schemas & Codegen — `common/` + `codegen/`

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

## 6. Frontend — `frontend/`

The frontend is intentionally small and focused on **job lifecycle visualization** rather than full profile management or artifact browsing.

### 6.1 Structure

```text
frontend/
├─ app/
│  ├─ global.css          # App styling (using tailwind compiler)
│  ├─ layout.tsx          # App shell, branding
│  └─ page.tsx            # Main page (upload + jobs)
├─ components/
│  ├─ UploadForm.tsx      # Image + prompt upload, calls /api/train
│  ├─ StatusCard.tsx      # Status pill + prompt + progress
│  └─ ProgressBar.tsx     # Visual progress indicator
├─ lib/
│  ├─ api.ts              # REST helpers (postGenerate, getJobResult)
│  ├─ enum.ts             # Common enums used in frontend
│  └─ ws.ts               # WebSocket hook for /ws
└─ tests/                 # Vitest + React Testing Library
```

### 6.2 Responsibilities

- Triggers video generation by POSTing to `/api/infinitetalk`.
- Establishes a WebSocket connection to `/ws` and subscribes to specific job IDs.
- Renders a StatusCard per job with up-to-date progress and status.
- Unsubscribes once a job reaches a terminal state.

The UI is minimal but wired to the same job and progress semantics that future, richer UIs will use.

## 7. Infrastructure & Dev Workflow — `infra/` + Dev Containers

The infrastructure layer consolidates shared services and development tooling:

- **Infra stack** (`infra/` + `docker-compose*.yml`):
  - Traefik proxy, TLS, and routing.
  - Redis + Redis Insight.
  - MinIO for artifacts.
  - PostgreSQL for job persistence.
  - Prometheus + Grafana for metrics and dashboards.
  - cAdvisor + DCGM Exporter for container and GPU metrics.
  - Ollama + OpenWebUI for llm management.
  - ComfyUI for diffusion pipelines management/prototyping.
- **Dev Containers**:
  - Each of `backend/`, `frontend/`, and `worker/` has its own `.devcontainer/` configuration.
  - Development happens inside these containers for parity with production images.
  - Development sandboxes make use of coding agents safe and more efficient.
  - Tests (Vitest / pytest) run inside their respective Dev Containers.

From a modular standpoint, each subsystem is effectively a self-contained module with its own runtime environment, while sharing infra services via Compose.

## 8. Service Startup Dependencies (`depends_on`)

```mermaid
graph TD
    subgraph "Root Services"
        traefik
        prometheus
        redis
        postgres
        minio
        ollama
    end

    subgraph "Dependent Services"
        grafana
        redis_exporter["redis-exporter"]
        redis_insight["redis-insight"]
        pgadmin
        openwebui
        comfyui
        api
        ui
        worker
        downloader
    end

    grafana -- depends_on --> prometheus
    redis_exporter -- depends_on --> redis
    redis_insight -- depends_on --> redis
    pgadmin -- depends_on --> postgres
    openwebui -- depends_on --> ollama
    comfyui -- depends_on --> traefik
    api -- depends_on --> redis
    api -- depends_on --> postgres
    ui -- depends_on --> api
    worker -- depends_on --> redis
    worker -- depends_on --> minio
    worker -- depends_on --> downloader
    downloader -- depends_on --> comfyui
    downloader -- depends_on --> ollama
```

This diagram shows the literal startup dependencies as defined by `depends_on` in the `docker-compose.yml` file across all profiles. An arrow from service A to service B means that service A will wait for service B to start before it starts itself.

## 🧭 Quick Navigation

➡️ [Go to Roadmap](./05_roadmap.md)  
⬅️ [Back to Technologies Stack](./03_tech_stack.md)