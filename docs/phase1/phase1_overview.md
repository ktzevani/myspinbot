# 🧫 Phase 1 — Backend & Frontend Scaffold

## 🎯 Objective

Phase 1 brings MySpinBot out of cryogenic sleep and gives it a **spine and pulse** — the backend–frontend scaffolding that ties the UI, API, Redis, and infrastructure into a single system.

This stage is about **structure**, **communication**, and **observability**.
GPU workloads still wait until Phase 2 — here we make the data and control pathways fully functional end-to-end.

## 🧱 Scope & Objectives

### 1️⃣ Backend (Fastify + Node 20 + BullMQ + Redis)

- Establish a clean modular architecture:

  - `/src/routes` — REST + WebSocket endpoints
  - `/src/controllers` — job logic (train/generate/status)
  - `/src/plugins` — Redis + Prometheus + WS plugins
  - `/src/workflows` — future LangGraph/Ollama hooks

- Implement core HTTP routes:

  - `GET /health` → `{status:"ok"}`
  - `GET /metrics` → Prometheus exposition
  - `POST /api/train` → enqueue LoRA training job (mock)
  - `POST /api/generate` → enqueue video generation job (mock)
  - `GET /api/status/:id` → retrieve job progress from Redis

- Integrate **BullMQ + Redis 7** for background jobs
- Add **WebSocket gateway (`/ws`)** for real-time progress updates
- Expose Prometheus metrics for job rates and WS connections
- Traefik exposure:

  - **Host:** `api.myspinbot.local` | **Port:** 3000 | **EntryPoint:** `websecure`

### 2️⃣ Frontend (Next.js 15 + TypeScript)

- Scaffold App Router layout:

  - `/app` — pages
  - `/components` — UI widgets
  - `/lib` — API helpers + WS hooks

- Styling stack: Tailwind + shadcn/ui
- Implement interactive dashboard view:

  - Backend health status (`/health`)
  - File/text upload form for `/train` and `/generate`
  - Job status list and progress bars (live via WebSocket)

- Add `.env`:

  - `NEXT_PUBLIC_API_URL=https://api.myspinbot.local`

- Traefik exposure:

  - **Host:** `ui.myspinbot.local` | **Port:** 3001

### 3️⃣ Infrastructure & Integration

- Extend Phase 0 `docker-compose.yml`:

  - Add `api`, `ui`, and `redis` services
  - Link to `internal-network` and monitoring stack
  - Define build contexts (`./backend`, `./frontend`)

- Prometheus: scrape `api:3000/metrics`
- Grafana: dashboard **“Backend ↔ Frontend ↔ Redis Loop”** with panels for Job Rate, Duration, WS Clients
- Optional: Redis Insight GUI (`redis.myspinbot.local`)
- Environment files: shared `.env` + `.env.local`

### 4️⃣ Development Workflow

- MySpinBot frontend/backend development workflow will be donen outside container infrastructure

  - Define workflow for backend
  - Define workflow for frontend

## ⚙️ Expected Outputs

| Component         | Deliverable               | Description                                         |
| ----------------- | ------------------------- | --------------------------------------------------- |
| **Backend**       | `/backend` directory      | Fastify API with job queues + WS broadcast          |
| **Frontend**      | `/frontend` directory     | Next.js UI with upload + progress view              |
| **Redis**         | `redis:7` service         | Queue storage + pub/sub backend                     |
| **Compose Stack** | `docker-compose.yml v1.1` | Adds `api`,`ui` and `redis` services and new labels |
| **Grafana**       | Dashboard update          | Job metrics + WS connections                        |

## 🧭 Quick Navigation

➡️ [Go to Phase 2 Overview](../phase2/phase2_overview.md)  
⬅️ [Back to Phase 0 Overview](../phase0/phase0_overview.md)
