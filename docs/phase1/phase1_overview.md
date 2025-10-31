# 🧭 Phase 1 — Backend & Frontend Scaffold

## 🎯 Objective  
Phase 1 brings MySpinBot out of cryogenic sleep and gives it a **spine** — the backend–frontend scaffolding that ties the UI, API, and infrastructure into a single living system.  

This stage doesn’t chase glamour — it’s about **strong structure**, **observability**, and **local reproducibility**.  
All GPU magic waits until Phase 2; here we build the web and data nervous system that makes later stages plug-and-play.  

## 🧱 Scope & Objectives  

### 1. **Backend (Fastify + Node 20)**  
- Establish a clean service architecture:  
  - `/src/routes` — HTTP route definitions  
  - `/src/controllers` — business logic stubs  
  - `/src/plugins` — reusable Fastify plugins (Redis, Prometheus, etc.)  
  - `/src/workflows` — placeholder for LangGraph integrations  
- Add health and metrics endpoints:  
  - `GET /health` → `{status: "ok"}`  
  - `GET /metrics` → Prometheus-ready exposition  
- Integrate **Redis + BullMQ** for background queues  
- Provide connection stubs for:  
  - **LangGraph.js** (future orchestration)  
  - **Ollama API** (local LLM)  
- Ensure Traefik exposure via:  
  - **Host:** `api.myspinbot.local`  
  - **EntryPoint:** `websecure`  
  - **Service port:** 3000  

### 2. **Frontend (Next.js 14 + TypeScript)**  
- Scaffold modern App Router layout:  
  - `/app` — page routes  
  - `/components` — UI elements  
  - `/lib` — API helpers and config  
- Integrate styling stack:  
  - Tailwind CSS + shadcn/ui  
- Implement minimal **dashboard view** displaying:  
  - Backend health status (via `/health`)  
  - Redis queue stats placeholder  
  - System info fetched from Prometheus (future hook)  
- Add `.env` config for API proxy:  
  - `NEXT_PUBLIC_API_URL=https://api.myspinbot.local`  
- Expose through Traefik:  
  - **Host:** `ui.myspinbot.local`  

### 3. **Infrastructure & Integration**  
- Extend Phase 0 `docker-compose.yml`:  
  - Add `api` (Fastify) and `ui` (Next.js) services  
  - Link to `internal-network` and existing monitoring stack  
  - Define build contexts (`./backend`, `./frontend`)  
- Prometheus:  
  - Add new scrape job for `api:3000/metrics`  
- Grafana:  
  - Create dashboard “Backend & Frontend Overview” (stub panel set)  
- Redis:  
  - Shared container or external service via network link  
- Environment:  
  - Shared `.env` and `.env.local` templates  

### 4. **Documentation & Repository Layout**  
- Create `docs/phase1/` directory containing:  
  - `phase1_overview.md` ← this document  
  - `phase1_backend_frontend.md` (implementation details)  
  - `phase1_compose_layout.md` (docker topology & Traefik routes)  
- Update top-level `README.md`:  
  - Add *Phase 1: In Progress* section  
  - Link to the new overview  
- Maintain the humor & aesthetic continuity of Phase 0  

## ⚙️ Expected Outputs  
| Component | Deliverable | Description |  
|------------|--------------|--------------|  
| **Backend** | `/backend` directory | Fastify boilerplate with health + metrics routes |  
| **Frontend** | `/frontend` directory | Next.js 14 scaffold with Tailwind + shadcn |  
| **Compose Stack** | `docker-compose.yml` v1.1 | Adds `api` + `ui` services |  
| **Docs** | `docs/phase1/*` | Planning, compose layout, and implementation logs |  
| **Grafana** | Dashboard stub | Displays backend availability and request rate |  

## 🧭 Next Steps  
1. Finalize repository skeleton (backend + frontend dirs, Dockerfiles).  
2. Integrate `api` and `ui` into Compose stack.  
3. Confirm Prometheus scraping and Grafana panel connectivity.  
4. Begin work on `phase1_backend_frontend.md` with runnable scaffolds.  

## 🧊 Closing Remark  
Phase 0 built the monitoring and proxy lungs.  
Phase 1 adds the **ribcage and pulse** — a living scaffold ready to host intelligence.  

Once this skeleton stands tall, Phase 2 will start to breathe GPU fire. 🔥  
