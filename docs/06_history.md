# Architecture & Stack History

This document captures how the current MySpinBot architecture and tech stack evolved from the original design, organised by **development phase**. Treat it as release notes for each iteration.

## 1) How to Read This

- Each phase section follows the same pattern:
  - **Original plan** – intent from the roadmap and early docs.
  - **Outcome in the repo** – what the codebase actually looks like now.
  - **What’s new / notable** – concise, “release notes” style bullets.
- Details are grouped by architecture, modular boundaries, and tech stack where useful, but the primary axis is **phase order** (Phase 0 → Phase 1 → Phase 2 → …).

## 2) Phase 0 — Infrastructure Bootstrap

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

## 3) Phase 1 — Backend & Frontend Scaffold

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

## 4) Phase 2 — Dual-Plane Orchestration Snapshot

Phase 2 is where the architecture becomes recognisably dual-plane and graph-centric.

### 4.1 Original plan

- Introduce a Python GPU worker connected to the backend via Redis:
  - Execute LoRA/TTS/video tasks on the worker.
  - Report progress and metrics back to the backend and Grafana.
- Move beyond simple queues toward LangGraph-based orchestration:
  - Node LangGraph for user-facing workflows.
  - Python LangGraph for GPU task DAGs.
  - Redis as the bridge between the two.

### 4.2 Outcome in the repo

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

### 4.3 What’s new / changed in Phase 2 (release-notes style)

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

- Removed BullMQ and any Celery/Dramatiq assumptions in favour of:
  - LangGraph.js / LangGraph.py + Redis Streams for orchestration.
- Standardised on **Dev Containers** for backend, frontend, and worker development.
- Kept infra choices stable (Traefik, Redis, MinIO, Prometheus, Grafana, cAdvisor, DCGM).

**Front-of-mind for future phases**

- Planner currently uses static graph templates; future phases are expected to make planning more intelligent while preserving the dual-plane and schema-driven foundations established here.
