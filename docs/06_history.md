# ⏱️ Architecture & Stack History

This document captures how the current MySpinBot architecture and tech stack evolved from an original design, organised by **development phase**. Treat it as release notes for each iteration.

## ❓ How to Read This

- Each phase section follows the same pattern:
  - **Original plan** – intent from the roadmap and early docs.
  - **Outcome in the repo** – what the codebase actually looks like now.
  - **What’s new / notable** – concise, “release notes” style bullets.
- Details are grouped by architecture, modular boundaries, and tech stack where useful, but the primary axis is **phase order** (Phase 0 → Phase 1 → Phase 2 → …).

## 1. Phase 0 — Infrastructure Bootstrap

### Original plan

- Stand up a Docker-based infrastructure backbone:
  - Docker Compose stack.
  - Traefik ingress with TLS and routing.
  - Prometheus + Grafana for basic metrics.
  - GPU exporter for visibility.

### Outcome in the repo

- `docker-compose.yml` provides the core infra:
  - Traefik v2 as reverse proxy.
  - Redis as the central coordination store.
  - MinIO as S3-compatible object storage.
  - Prometheus + Grafana, Redis exporter, cAdvisor, and NVIDIA DCGM exporter (via the `observability` profile).
  - Redis Insight for inspection.
- `infra/` holds service-specific configuration (Traefik, Prometheus, Grafana, MinIO, Redis Insight).

### What’s new / notable in Phase 0

- Single **`internal-network`** bridge shared by all services, matching the later modular design.
- Metrics-first posture: every infra component either exposes metrics directly or via exporters.
- TLS and routing patterns (e.g. `*.myspinbot.local`) defined from day one and reused in later phases.

## 2. Phase 1 — Backend & Frontend Scaffold

### Original plan

- Bring up the initial application layer on top of the infra:
  - Node.js Fastify backend with minimal API endpoints.
  - Next.js frontend for uploads and job status.
  - WebSocket channel for live progress.
  - Basic Redis usage for job state.

### Outcome in the repo

- **Backend (`backend/`):**
  - Fastify server with routes for health, metrics, training, job status, capabilities, and `/ws`.
  - WebSocket hub for `SUBSCRIBE` / `UNSUBSCRIBE` per `jobId`.
  - Initial Planner and JobQueue abstractions tied to Redis.
- **Frontend (`frontend/`):**
  - Minimal Next.js app with `UploadForm`, `StatusCard`, and `ProgressBar` components.
  - WebSocket client hook (`lib/ws.ts`) and REST helpers (`lib/api.ts`).

### What’s new / notable in Phase 1

- Clear separation between **experience layer** (Next.js) and **control plane** (backend).
- WebSocket-based job updates and REST APIs established as the primary client contract.
- Early LangGraph usage on the Node side to describe workflows, paving the way for Phase 2.

## 3. Phase 2 — Dual-Plane Orchestration Snapshot

Phase 2 is where the architecture becomes recognisably dual-plane and graph-centric.

### 3.1 Original plan

- Introduce a Python GPU worker connected to the backend via Redis:
  - Execute LoRA/TTS/video tasks on the worker.
  - Report progress and metrics back to the backend and Grafana.
- Move beyond simple queues toward LangGraph-based orchestration:
  - Node LangGraph for user-facing workflows.
  - Python LangGraph for GPU task DAGs.
  - Redis as the bridge between the two.

### 3.2 Outcome in the repo

**Architecture & Flows**

- Control plane (`backend/`):
  - Fastify API and WebSocket hub.
  - Planner builds LangGraph graphs (currently static templates) for `/api/train` and `/api/capabilities`.
  - Control Executor runs `plane: "node"` nodes and hands off graphs to the data plane.
  - JobQueue uses Redis Streams + Pub/Sub for control/data streams and job state.
- Data plane (`worker/`):
  - FastAPI app with `/health` and `/metrics`.
  - Redis Bridge consumes from the data stream and publishes progress/status/data via Pub/Sub.
  - Worker Executor (LangGraph.py) runs `plane: "python"` nodes (`train_lora`, `train_voice`, `render_video`, `get_capabilities`).
  - Dummy artifacts written to MinIO via the MinIO Python SDK.
- End-to-end training flow:
  - `POST /api/train` → Planner graph → control stream → control executor → data stream → worker executor → job completion + artifacts + metrics.
  - WebSocket clients receive consolidated job updates from the backend.

**Modular Structure**

- Backend and worker are now explicitly “control plane” and “data plane”.
- Shared schema layer introduced via `common/` + `codegen/`:
  - JSON Schemas for graphs, jobs, capabilities, Redis config, and storage.
  - Generated AJV validators in `backend/src/validators/**`.
  - Generated Pydantic models in `worker/src/worker/models/**`.
- Frontend remains intentionally small but is wired to these job semantics.

**Tech Stack**

- Orchestration:
  - LangGraph.js (backend) and LangGraph.py (worker) as the core orchestration tools.
  - Redis Streams + Pub/Sub as the sole control/data fabric (no BullMQ, no Celery).
- Validation:
  - AJV (backend) and Pydantic v2 (worker) generated from shared schemas.
- Dev workflow:
  - VS Code Dev Containers per subsystem (`backend/`, `frontend/`, `worker/`).
  - `docker-compose.dev.yml` for live coding and debugging on top of the production-like infra.

### 3.3 What’s new / changed in Phase 2 (release-notes style)

**Architecture**

- Switched from queue/message-centric orchestration to **graph-centric dual-plane LangGraph**:
  - Graph JSON is the contract between control and data planes.
  - Each plane has its own executor for `plane: "node"` / `plane: "python"` nodes.
- Promoted the Python service from a generic “GPU worker” to a **full data plane**:
  - Clear Redis bridge, executor, task registry, and metrics.

**Modules & Boundaries**

- Added an explicit **shared schema module**:
  - `common/` + `codegen/` are now required to keep Node and Python in sync.
- Folded the separate queue module into:
  - `backend/src/core/job-queue.js` (Redis Streams + Pub/Sub).
  - LangGraph graphs as the primary job representation.

**Tech Stack**

- Removed BullMQ and any Celery assumptions in favour of:
  - LangGraph.js / LangGraph.py + Redis Streams for orchestration.
- Standardised on **Dev Containers** for backend, frontend, and worker development.
- Kept infra choices stable (Traefik, Redis, MinIO, Prometheus, Grafana, cAdvisor, DCGM).

**Front-of-mind for future phases**

- Planner currently uses static graph templates; future phases are expected to make planning more intelligent while preserving the dual-plane and schema-driven foundations established here.

## 4. Phase 3 — AI Pipeline Implementation Snapshot

Phase 3 marks the transition of MySpinBot into a real AI video pipeline, building on the dual-plane LangGraph foundation from Phase 2. This phase focused on integrating core AI services, establishing durable persistence, and advancing the orchestration capabilities.

### 4.1 Original plan

The plan for Phase 3 was ambitious, aiming to introduce end-to-end LLM → diffusion/video → TTS → lip-sync workflows with multiple pipeline variants (e.g., SVD+Wav2Lip, SadTalker). It also included a persistent job and artifact store (PostgreSQL), a first version of an Agentic Planner, a **Dramatiq-backed worker execution model**, and dedicated AI runtime services (Ollama, Open WebUI, ComfyUI) managed by Docker Compose and Traefik. The ultimate goal was for users to be able to train basic profiles and generate short, low-resolution videos driven by local LLM scripts.

### 4.2 Outcome in the repo

**Architecture & Flows**

- **PostgreSQL Integration:** PostgreSQL and pgAdmin services were successfully added to the Docker Compose stack, providing durable storage for job metadata, LangGraph snapshots, and artifact records. Backend persistence hooks were implemented in the JobQueue to mirror Redis events into Postgres, and new API endpoints (`/api/jobs`, `/api/jobs/:id`) now expose job history.
- **AI Runtime Services:** Ollama, Open WebUI, and ComfyUI were integrated as containerized services in the `docker-compose.yml` (`ai` profile), with Traefik routing configured for external access to Open WebUI and ComfyUI. GPU resources are managed for Ollama and ComfyUI.
- **Advanced Pipeline Definitions:** A pipeline catalog (`backend/src/core/pipelines.js`) was introduced to define multiple LangGraph variants (`f5tts_infinitetalk`, `svd_wav2lip`, `sadtalker`). The Planner now builds these hybrid graphs, stamping pipeline metadata into the graph context. The `/api/train` endpoint is variant-aware, and the frontend is wired to submit detailed pipeline requests.
- **LLM Integration:** The `script.generateScript` node in the backend was upgraded to make real calls to a configurable Ollama endpoint, with fallback mechanisms. LLM defaults are now configurable in the backend.
- **Worker Orchestration:** While planned to be Dramatiq-backed, the worker currently utilizes direct invocation of task functions from LangGraph nodes for GPU-style tasks. Dramatiq dependencies are present but its full actor-based framework is currently postponed for future integration. Tasks produce real, typed artifacts (JSON manifests, WAV samples) uploaded to MinIO.
- **InfiniteTalk Pipeline:** The `f5tts_infinitetalk` pipeline is fully implemented, with its `f5_to_tts` task synthesizing speech audio, its `infinite_talk` task producing lip-sync video out of an input portrait image and the synthesized audio and final its `upscale_video` task which upscales the staged video output and corrects any upscale artifacts on the character's face.

**Modular Structure**

- The modular breakdown continued to refine, with dedicated modules for pipelines and media helpers within the backend and worker respectively.
- Shared schemas continue to ensure consistency across the Node.js and Python planes for complex pipeline definitions and job states.

**Tech Stack**

- **PostgreSQL:** Added as the primary relational database for durable state.
- **Dramatiq:** Introduced in the Python worker for robust internal job execution and management. Still remains unused though in actual runtime.
- **Ollama:** Integrated as the local LLM runtime, providing real-time script generation capabilities.
- **ComfyUI:** Integrated for diffusion and image/video generation workflows.
- The existing dual-plane LangGraph orchestration with Redis Streams remains central, now with PostgreSQL providing the long-term historical record.

### 4.3 What’s new / changed in Phase 3 (release-notes style)

**Architecture**

- **Durable Persistence:** Full integration of **PostgreSQL** (`pg` client, `job-repository.js`) for comprehensive job and artifact history, providing a durable audit trail beyond Redis's ephemeral state.
- **Real AI Capabilities:** Deployment of **Ollama, Open WebUI, and ComfyUI** as first-class services via Docker Compose profiles, shifting from simulated to actual LLM and diffusion model interactions.
- **LLM-Driven Scripting:** The `script.generateScript` handler in the backend now performs **direct API calls to Ollama**, dynamically generating stage prompts and narrations.
- **Worker Task Execution:** The worker processes GPU-style tasks via direct invocation of task functions from LangGraph nodes. The planned full Dramatiq-backed actor framework is currently not in active use, though its dependencies are present. Tasks are managed by the worker process itself.
- **Implemented AI Pipeline:** Only the `f5tts_infinitetalk` pipeline has been fully implemented, demonstrating end-to-end LLM-driven video generation. Other pipeline variants (`sadtalker`, `svd_wav2lip`) exist as predefined graphs but currently rely on dummy worker tasks.

**Modules & Boundaries**

- **Backend `pipelines.js`:** Centralized definition of multiple LangGraph workflow variants (e.g., `f5tts_infinitetalk`, `svd_wav2lip`, `sadtalker`), enabling the `Planner` to construct dynamic workflow DAGs.
- **Worker `workflows/`:** Introduced Python modules (`infinitetalk.py`, `tts.py`, `upscaler.py`) that programmatically orchestrate ComfyUI nodes and other AI models, leveraging a custom ComfyUI embedding for headless execution.
- **Frontend `lib/api.ts`:** Enhanced to support **variant-aware API requests**, allowing users to select and parameterize different pipeline types.

**Tech Stack**

- **PostgreSQL (16-alpine)**: The core relational database for long-term job and event storage.
- **Dramatiq**: Integrated for asynchronous task execution within the Python worker.
- **Ollama (0.13.1)**: Provides local LLM inference for script generation.
- **ComfyUI (custom image)**: Programmatically utilized within the worker for image/video diffusion workflows.
- **pgAdmin, Open WebUI**: Management UIs for PostgreSQL and Ollama, respectively, enhancing operational visibility.

**Front-of-mind for future phases**

- Advancing the `Planner` to a fully agentic state, capable of generating workflows from high-level user intent and dynamic worker capabilities.
- Putting dramatiq task management in action.
- Implementing additional video/audio generation workflows.
- Deepening observability for AI pipelines with more granular, task-specific latency and GPU metrics.
- Expanding artifact and profile management functionalities for greater user control.

## 🧭 Quick Navigation

⬅️ [Back to Roadmap](./05_roadmap.md)