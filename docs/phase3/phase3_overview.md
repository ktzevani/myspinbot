# 🔁 Phase 3 — AI Pipeline Implementation

## 🎯 Objective

Phase 3 turns MySpinBot from a dual‑plane orchestration demo into a **real AI video pipeline**.  
Building on the control/data split and LangGraph infrastructure from Phase 2, this phase introduces:

- End‑to‑end **LLM → diffusion/video → TTS → lip‑sync** workflows.
- A persistent **job and artifact store** (PostgreSQL) alongside Redis.
- A first version of the **Agentic Planner** that generates hybrid LangGraph graphs from user intent and worker capabilities.
- A **Dramatiq‑backed worker execution model** running GPU‑style tasks behind LangGraph’s `plane: "python"` nodes.
- Dedicated **AI runtime services** (Ollama + Open WebUI, ComfyUI, and TTS / lip‑sync runtimes) managed by Docker Compose and Traefik.

By the end of Phase 3, a user should be able to:

- Train a basic profile (reusing Phase 2 worker tasks), and
- Generate short, low‑resolution videos driven by a local LLM script and rendered through the GPU worker,

with all steps recorded as structured jobs, artifacts, and metrics.

## ⚙️ Core Goals

### 1️⃣ Persistence & Job History (PostgreSQL)

- Introduce **PostgreSQL** as the primary source of truth for:
  - Job metadata (type, status, timestamps, parameters).
  - Graph snapshots (serialized LangGraph per major transition).
  - Artifact records (URIs in MinIO, file types, sizes, provenance).
- Add a lightweight **persistence layer** to the backend:
  - Schema migrations for core tables: `jobs`, `job_events`.
  - Repository module for reading/writing job state in sync with Redis keys.
  - Simple `GET /api/jobs` and `GET /api/jobs/:id` endpoints for history/introspection.
- Define clear **ownership rules**:
  - Redis Streams + Pub/Sub remain the real‑time execution bus.
  - Postgres becomes the durable record of what happened (audit trail, history, analytics).

#### ✅ Goal 1 — Current Implementation Snapshot

- **Postgres service** added to the Compose stack (credentials are provisioned by automation scripts, port 5432 exposed in dev overlay).
- **pgAdmin service** added to the Compose stack (credentials are provisioned by automation scripts, public URL is configured via traefik).
- **Schema + migrations** applied at backend startup: `jobs`, `job_events` tables with indexes and uniqueness on `(job_id)`.
- **Persistence hooks** inside the JobQueue mirror enqueue/status/progress/data events from Redis into Postgres and store LangGraph snapshots per update.
- **History APIs**: `GET /api/jobs` (paged list) and `GET /api/jobs/:id` (job + last graph + recent events) now surface stored records.

### 2️⃣ End‑to‑End Pipeline Definitions

- Formalize the **first production pipeline** as a concrete LangGraph template:
  - Control‑plane nodes:
    - `script.generateScript` → real LLM call via Ollama.
    - Optional post‑processing / safety filters.
  - Data‑plane nodes:
    - `train_lora` / `train_voice` (can remain partially simulated but wired for future real models).
    - `render_video` → integration point for ComfyUI + video assembly.
- Define **two pipeline variants** (matching the architecture docs):
  - SVD + Wav2Lip path (scene → video → TTS → lip‑sync).
  - SadTalker path (portrait → talking‑head animation + TTS).
- Capture each variant as a **named workflow**:
  - Shared schema entries for `workflowId`, `variant`, and allowed parameters.
  - Planner aware of which variant is requested / default.

#### ✅ Goal 2 — Current Implementation Snapshot

- **Pipeline catalog added**: new `backend/src/core/pipelines.js` defines two variants (`svd_wav2lip`, `sadtalker`) with LangGraph templates for train-and-generate and generate-only runs (script → LoRA/voice → render with variant-aware params).
- **Planner now builds hybrid graphs**: `Planner#getJobGraph` delegates to the pipeline catalog, validates DAGs, and stamps pipeline metadata (mode, variant, prompt, options, profileId) into both graph context and metadata.
- **Variant-aware API surface**: `/api/train` accepts optional JSON body (`mode`, `variant`, `prompt`, `options`, `profileId`), defaults to train-and-generate + `svd_wav2lip`, and queues the corresponding pipeline graph.
- **Front-end request wiring**: `frontend/lib/api.ts` now POSTs JSON to `/api/train` with prompt + default mode/variant, ready for future UI controls without needing multipart uploads.
- **Graph shape tests**: added `backend/tests/planner.test.js` to assert planner output for default (train+generate, SVD+Wav2Lip) and generate-only SadTalker pipelines, including metadata and params.
- **Worker tasks honor variants/options**: `worker/src/worker/services/tasks.py` now threads `variant`/`preset`/`options` into simulated LoRA/voice/render tasks (artifact naming + logs), matching the pipeline definitions.

### 3️⃣ AI Runtime Services & Infra (Ollama, Open WebUI, ComfyUI)

- Add dedicated **LLM and diffusion services** to the Docker/Traefik stack:
  - `ollama` (GPU‑enabled) as the local LLM host.
  - `open-webui` as the human‑facing UI for managing and experimenting with Ollama models (hard requirement).
  - `comfyui` (GPU‑enabled) as the diffusion / video workflow engine, reachable both headless and via its own web UI.
- Integrate these services into the existing infra patterns:
  - Traefik routing with new hostnames (e.g. `openwebui.myspinbot.local`, `comfyui.myspinbot.local`) and TLS via the existing wildcard certificates.
  - Shared Docker network with backend, worker, and Redis so that:
    - Backend LangGraph nodes can call Ollama via an internal HTTP endpoint.
    - Worker tasks can call ComfyUI via an internal hostname.
- Document **resource and GPU considerations**:
  - Default placement of GPU access (ComfyUI, Ollama, and the worker as GPU consumers; the worker also hosts any TTS / lip‑sync / ESRGAN runtimes that do not ship their own web server).
  - Recommended concurrency limits and queueing strategy so that only safe numbers of GPU‑heavy jobs run at once.
- Ensure the new services are visible in observability:
  - At minimum, container‑level metrics via cAdvisor and DCGM.
  - Optional service‑level Prometheus metrics if available from Ollama / ComfyUI images.

### 4️⃣ LLM & Agentic Planner Integration

- Replace the stubbed `script.generateScript` with a **real LLM integration**:
  - Backend LangGraph node that calls Ollama (via HTTP) using configurable model + prompt templates.
  - Structured output: stage description + narrative text, validated against shared schemas.
- Introduce a **minimal Agentic Planner** in the control plane:
  - Input: user request (prompt + options), worker capability manifest, and selected pipeline variant.
  - Output: a valid hybrid LangGraph graph with:
    - Nodes tagged by `plane` (`"node"` / `"python"`).
    - Correct dependencies (script → train_lora → render_video, etc.).
  - Validation hooks to ensure:
    - Only registered tasks are used.
    - Plan respects capability constraints (e.g. disabled TTS/lip‑sync features).
- Keep the planner **single‑pass and deterministic** in Phase 3:
  - No iterative optimization loops yet; just predictable, testable graph generation.

### 5️⃣ Worker‑Side Pipeline Orchestration (ComfyUI, TTS, Lip‑Sync, Dramatiq)

- Introduce **Dramatiq** into the worker as the internal job execution framework for GPU‑style tasks:
  - Define Dramatiq actors for `train_lora`, `train_voice`, `render_video`, and any auxiliary long‑running steps.
  - Integrate Dramatiq with the existing Redis bridge so LangGraph python‑plane nodes can dispatch work to actors while still reporting progress/status via Streams + Pub/Sub.
  - Extend worker configuration schemas to cover Dramatiq broker settings and concurrency limits, and expose basic Dramatiq metrics.
- Keep the Python worker focused on **data‑plane execution + orchestration**:
  - The worker container ships LangGraph.py, Dramatiq, the Redis bridge, and all non‑server‑style AI runtimes needed for pipelines:
    - TTS stack (e.g., F5‑TTS / GPT‑SoVITS).
    - Lip‑sync / talking‑head stack (e.g., Wav2Lip, SadTalker).
    - Optional ESRGAN / audio utilities.
  - Only facilities that include their own web server (Ollama, Open WebUI, ComfyUI) live in separate containers.
- Extend the worker with **integration hooks**:
  - ComfyUI integration:
    - Configurable base URL and API key (if needed) in worker config schema.
    - Tasks for invoking predefined ComfyUI workflows (image→video, talking‑head) with parameters from graph nodes.
  - TTS integration:
    - Internal Python APIs or subprocess wrappers around the TTS runtimes embedded in the worker image.
    - Common interface for generating WAV/FLAC given text + voice profile reference.
  - Lip‑sync / talking‑head integration:
    - Internal Python APIs or subprocess wrappers for Wav2Lip / SadTalker.
    - Accept video + audio inputs (by URI) and return a new video URI in MinIO.
- For Phase 3, it is acceptable to:
  - Implement **“hybrid” tasks** that call real services when available, but fall back to simulated output when not.
  - Focus on **correct orchestration and data flow** (URIs, parameters, progress) over perfect visual quality.

### 6️⃣ Artifact & Profile Management

- Introduce basic **artifact semantics** around MinIO usage:
  - Every task that produces a file registers an artifact record in Postgres.
  - Artifacts carry type, jobId, originating node, URIs, size, and optional preview metadata.
- Establish a **minimal profile model**:
  - Link LoRA/TTS artifacts to a logical “profile” entity (even if UI remains minimal).
  - Support reusing an existing profile for generation‑only jobs in Phase 3 (no retraining).
- Expose essential artifact/profile info via API:
  - `GET /api/jobs/:id` → returns associated artifacts and pipeline summary.
  - Simple profile listing endpoint for future UI features.

### 7️⃣ Observability for AI Pipelines

- Extend metrics in both planes to cover **AI‑specific signals**:
  - Per‑task latency histograms (LLM, ComfyUI calls, TTS, lip‑sync).
  - Job success/failure counters by workflow variant.
  - GPU utilization sampled during pipeline execution (building on DCGM metrics).
- Add basic **pipeline‑focused Grafana panels**:
  - “AI Pipeline Overview” dashboard showing:
    - Number of pipeline runs over time.
    - Breakdown of failures by node type.
    - Per‑stage latency and VRAM usage.
- Improve logging around LangGraph execution:
  - Structured logs for node start/finish, including jobId, workflowId, nodeId, and plane.
  - Clear error paths for failed nodes with enough context to debug model/infra issues.

### 8️⃣ Developer Workflow & Testing Strategy for Phase 3

- Backend:
  - Unit tests for the Agentic Planner to assert expected graph shapes for given prompts/capabilities.
  - Integration tests for `/api/train` and new generation endpoints hitting real/simulated LLM + worker flows.
  - Tests for Postgres persistence (job + artifact records) in isolation.
- Worker:
  - Tests around ComfyUI/TTS/lip‑sync task wrappers using mocks or local test endpoints.
  - Validation that progress/status emissions remain consistent across the new tasks.
- Frontend:
  - UI extensions tested via Vitest/RTL:
    - Controls for selecting **mode** (train‑and‑generate vs generate‑only) and **pipeline variant** (SVD + Wav2Lip vs SadTalker).
    - Basic profile selection UI for generation‑only jobs.
    - Surfacing of pipeline details and artifact information (e.g., video link, variant label, created time).
- CI / Dev workflow:
  - Optional docker‑compose profile to start **only** the services needed for AI pipeline development (backend, worker, Redis, MinIO, Postgres, ComfyUI, Ollama).
  - Documentation updates in `docs/` describing how to run and test Phase 3 pipelines end‑to‑end on a single GPU machine.

### 9️⃣ Frontend UX for AI Pipelines

- Extend the existing Next.js dashboard to support the richer Phase 3 workflows:
  - Update `UploadForm` to:
    - Offer **mode selection**: “Train & Generate” vs “Generate from Existing Profile”.
    - Allow choosing a **pipeline variant** (SVD + Wav2Lip or SadTalker) and basic options (duration, resolution presets).
    - Support selecting an existing profile (from a simple dropdown or ID field) when in generate‑only mode.
  - Enhance job display (`StatusCard` and related components) to:
    - Show pipeline metadata: variant, mode, profile label, and key timestamps.
    - Indicate multi‑stage progress (e.g., scripting → training → rendering) while still relying on the existing WebSocket update stream.
  - Optionally add a lightweight **job history** view backed by the new Postgres job endpoints for inspecting recent runs.
- Keep the UI changes incremental and aligned with current patterns:
  - Reuse the existing WebSocket contract and job status model.
  - Avoid heavy UX overhauls in Phase 3; focus on enabling the new flows and making pipeline/state visible.

## 📚 Docs Reference

| Document                                         | Purpose                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| [phase3_overview.md](./phase3_overview.md)       | **This document**, phase overview and implementation plan.  |
| [ai_pipelines.md](./ai_pipelines.md)             | AI pipeline variants, LangGraph workflow shapes, and API contracts.         |

## 🧭 Quick Navigation

⬅️ [Back to Phase 2 Overview](../phase2/phase2_overview.md)
