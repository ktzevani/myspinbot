# 🔁 Phase 3 — AI Pipeline Implementation

## 🎯 Objective

Phase 3 transforms MySpinBot from a dual‑plane orchestration demo into a **real AI video pipeline**. Building on the control/data split and LangGraph infrastructure from Phase 2, this phase introduces:

- End‑to‑end **LLM → diffusion/video → TTS → lip‑sync** workflows, demonstrating a complete pipeline, with specific variants implemented.
- A robust **persistent job metadata and history store** (PostgreSQL) integrated alongside Redis for enhanced data durability.
- A foundational **graph generation logic** capable of constructing hybrid LangGraph workflows from predefined templates, laying the groundwork for a future, more autonomous planner agent.
- An enhanced **worker execution model** for managing GPU‑style (e.g., PyTorch, CUDA/PyCUDA) tasks invoked by LangGraph’s `plane: "python"` nodes, with provisions for advanced task queuing.
- Dedicated **AI runtime services** (Ollama + Open WebUI, ComfyUI, and embedded TTS / lip‑sync capabilities) managed seamlessly through Docker Compose and Traefik.

By the end of Phase 3, a user can initiate the generation of short, high-quality videos driven by a local LLM script and rendered through the GPU worker, with all execution steps, artifacts, and metrics comprehensively recorded.

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

**Implemented:**

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
- Define **three pipeline variants** (matching the architecture docs):
  - f5 TTS + InfiniteTalk + AI Upscaler.
  - SVD + Wav2Lip path (scene → video → TTS → lip‑sync).
  - SadTalker path (portrait → talking‑head animation + TTS).
- Capture each variant as a **named workflow**:
  - Shared schema entries for `workflowId`, `variant`, and allowed parameters.
  - Planner aware of which variant is requested / default.

**Implemented:**

- **Pipeline catalog added**: new `backend/src/core/pipelines.js` defines three variants (`f5tts_infinitetalk`, `svd_wav2lip`, `sadtalker`) with LangGraph templates for train-and-generate and generate-only runs (script → LoRA/voice → render with variant-aware params). 
- **Planner now builds hybrid graphs**: `Planner#getJobGraph` delegates to the pipeline catalog, validates DAGs, and stamps pipeline metadata (mode, variant, prompt, options) into both graph context and metadata.
- **Variant-aware API surface**: `/api/train` accepts optional JSON body (`mode`, `variant`, `prompt`, `options`), defaults to train-and-generate + `svd_wav2lip`, and queues the corresponding pipeline graph.
- **Front-end request wiring**: `frontend/lib/api.ts` now POSTs JSON to `/api/train` with prompt + default mode/variant, ready for future UI controls without needing multipart uploads.
- **Graph shape tests**: added `backend/tests/planner.test.js` to assert planner output for SVD+Wav2Lip (train LoRA and generate) and generate-only SadTalker and InfiniteTalk pipelines, including metadata and params.
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

**Implemented:**

- **Services added to Compose (profile `ai`)**: `ollama` (GPU), `openwebui`, and `comfyui` now ship in `docker-compose.yml` with dedicated data volumes and NVIDIA device reservations for Ollama/ComfyUI. For `comfyui` a custom docker image is developed.
- **Traefik routing**: `https://openwebui.${PROJECT_DOMAIN}` and `https://comfyui.${PROJECT_DOMAIN}` are exposed behind the existing BasicAuth middleware; Ollama stays internal-only for security. Use `--profile ai` when starting the stack.
- **Usage example**: `docker compose --profile ai up -d ollama openwebui comfyui` then browse to the routed hostnames. Open WebUI points at the internal Ollama host by default.
- **Observability**: these services sit on the same `internal-network` and are covered by cAdvisor/DCGM exporter for container/GPU metrics; service-level metrics can be added later if images expose them.

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
  - No automated graph compilation by agent yet
  - No iterative optimization loops yet; just predictable, testable graph generation.

**Implemented:**

- **Real script generation hook**: `script.generateScript` now calls a configurable Ollama endpoint (`LLM_ENDPOINT`/`OLLAMA_BASE_URL`, default `http://ollama:11434/api/generate`) with a JSON-only prompt template. Falls back to a deterministic narration/stage pair if the LLM fails or times out.
- **Configurable defaults**: LLM defaults (model, temperature, tone/persona, length, timeout) live in backend configuration and are threaded into planner-generated script nodes.
- **Data emission**: successful runs publish `{ script: { stagePrompt, narration, tokensUsed, model } }` via the existing data callback for downstream consumers.

### 5️⃣ Worker‑Side Pipeline Orchestration (ComfyUI, TTS, Lip‑Sync)

- Keep the Python worker focused on **data‑plane execution + orchestration**:
  - The worker container ships LangGraph.py, Dramatiq, the Redis bridge, and all non‑server‑style AI runtimes needed for pipelines:
    - TTS stack (e.g., F5‑TTS / GPT‑SoVITS).
    - Lip‑sync / talking‑head stack (e.g., Wav2Lip, SadTalker).
    - Optional ESRGAN / audio utilities.
  - Only facilities that include their own web server (Ollama, Open WebUI, ComfyUI) live in separate containers.
- Extend the worker with ComfyUI facilities:
  - Map worker container to ComfyUI volume (so that worker and comfyui infrastructure service share common configuration/models)
  - ComfyUI integration:
    - Make use of dynamic module resolution to enable comfyui facilities in worker process.
    - Integrate PyTorch, PyCuda and comfyui custom nodes and base libraries in the worker process.
    - Integrate access to object storage from worker process for the former to be used as an artifact repository.
- For Phase 3, it is acceptable to:
  - Implement **“hybrid” tasks”** that call real services when available, but fall back to simulated output when not.

**Implemented:**

- **ComfyUI Integration:** `workflows/__init__.py` handles the dynamic initialization and loading of ComfyUI's custom nodes and environment, enabling programmatic orchestration of ComfyUI workflows within the worker process.
- **Embedded AI Runtimes:** The worker container directly integrates LangGraph.py, along with required non‑server‑style AI runtimes and models.
- **Object Storage Access:** Integrated access to MinIO from the worker process, allowing for seamless handling of input assets and output artifacts.
- **Key Workflows:**
  - **Text-to-Speech (`f5_to_tts` task via `tts.py`):** Synthesizes speech audio using dynamically loaded F5TTSNode from a custom ComfyUI node, processes it, and uploads the resulting WAV artifact to MinIO.
  - **Image-to-Video (`infinite_talk` task via `infinitetalk.py`):** Orchestrates a complex sequence of ComfyUI nodes to perform multi-talk image-to-video generation from an input image and pre-synthesized audio, ultimately uploading the generated video (MP4) to MinIO. This is the core `f5tts_infinitetalk` render pipeline.
  - **AI Upscaling (`upscale_video` task via `upscaler.py`):** Processes video in chunks, performing upscaling and face restoration using ComfyUI nodes, and utilizing FFmpeg for audio muxing and video concatenation, then uploads the final high-resolution video to MinIO.
- **Hybrid Task Execution Principle:** The system allows for "hybrid" tasks where real services are called, with implicit understanding that fallbacks (like placeholder images/audio) are used if real data/models are not fully configured or available, maintaining a focus on correct orchestration and data flow.

## 📚 Docs Reference

| Document                                         | Purpose                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| [phase3_overview.md](./phase3_overview.md)       | **This document**, phase overview and implementation plan.  |
| [ai_pipelines.md](./ai_pipelines.md)             | AI pipeline variants, LangGraph workflow shapes, and API contracts.         |

## 🧭 Quick Navigation

⬅️ [Back to Phase 2 Overview](../phase2/phase2_overview.md)
