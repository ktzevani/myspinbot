# Tech Stack Listing

This section enumerates every core technology, framework, and dependency that composes MySpinBot. It explains versioning targets, compatible alternatives, and the rationale for inclusion or exclusion—emphasizing open-source, local-first, GPU-ready components.

## 1️⃣ Overview Table

| Layer | Component | Version Target | Role | Viable Alternatives | Rationale |
|:------|:-----------|:----------------|:------|:--------------------|:--------------------------|
| **Frontend** | **Next.js (React 19 + TypeScript)** | `14.x` | Web interface, training/upload forms, real-time progress dashboard | Vite + React, SvelteKit, Astro | Next.js offers best full-stack integration (SSR + API routes) and vibrant ecosystem; aligns with LangChain.js demos and Open WebUI embedding. |
|  | TailwindCSS + shadcn/ui | `^3.4` | Styling, components | Chakra UI, MUI, DaisyUI | Tailwind is compact and composable; shadcn/ui aligns stylistically with the admin-like app; MUI too heavy for embedded dashboard use. |
|  | Zustand | `^5.0` | Frontend state management | Redux Toolkit, Recoil | Simple and minimal; Redux too verbose for small local UI; Recoil ecosystem smaller. |
| **Backend (JS)** | **Fastify (TypeScript)** | `^4.27` | Main API server, WebSocket channel | Express, Hono | Fastify chosen for speed, built-in schema validation, and production maturity; Express slower under high concurrency. |
|  | LangChain.js + LangGraph.js | `^0.2` | LLM orchestration + workflow graphs | LangFlow (UI only), AutoGPT.js | LangGraph brings deterministic flow control missing from vanilla LangChain; LangFlow is visual only and less automatable. |
|  | BullMQ | `^5.10` | Redis-backed job queue (Node) | RabbitMQ (amqp), BeeQueue | Native Redis integration, TypeScript types, simpler ops stack; RabbitMQ adds infra complexity. |
| **LLM Stack** | **Ollama** | `>=0.3.10` | Model runtime hosting (OLMo, Mistral, Phi-3, etc.) | LM Studio, Text-Generation-WebUI | Ollama is a lightweight model server exposing a stable REST API with multi-model caching; alternatives like LM Studio or Text-Generation-WebUI are primarily UIs and heavier, and they do not provide the same standardized daemon API by default. |
|  | Open WebUI | `^0.2.8` | Web front-end for managing Ollama models | AnythingLLM, LibreChat | Open WebUI natively integrates with Ollama (no adapters) and fits local management use-case; LibreChat heavier and multi-backend oriented. |
| **Diffusion / Video** | **ComfyUI** | `>=0.2.1` | Node-based image/video workflow engine | Automatic1111, Forge, InvokeAI | ComfyUI is modular, API-driven, and designed for automation; others are GUI-first with limited headless mode. |
|  | Stable Video Diffusion | `1.1` | Image→Video synthesis | Runway Gen2, ModelScope I2V | SVD is open and GPU-efficient; Gen2 is closed-source, ModelScope slower on mid-tier GPUs. |
|  | ESRGAN (Real-ESRGAN) | `^0.3.0` | Frame upscaling | SwinIR, BSRGAN | ESRGAN nodes are mature in Comfy ecosystem; newer SR models require heavier compute. |
|  | SadTalker / Wav2Lip | `SadTalker 0.0.2`, `Wav2Lip 1.0` | Lip-sync and talking head animation | PC-AVS, MakeItTalk | SadTalker + Wav2Lip combo open, lightweight, and proven; PC-AVS is research-only; MakeItTalk deprecated. |
| **Training / Voice** | **kohya_ss / sd-scripts** | `>=2024.01` | LoRA training | Diffusers LoRA Trainer | kohya scripts more flexible for quick dataset finetuning; HuggingFace Diffusers LoRA heavier, slower. |
|  | F5-TTS or GPT-SoVITS | `>=2024.02` | Few-shot voice cloning | Bark, StyleTTS2 | F5-TTS open, runs on consumer GPUs; Bark lacks speaker consistency, StyleTTS2 closed weights. |
| **GPU Jobs (Python)** | **FastAPI (microservice)** | `^0.115` | API for Python worker metrics | Flask, Sanic | FastAPI async-first, native Pydantic integration; lighter than Flask; Sanic less ecosystem support. |
|  | Celery / RQ | `^5.4` / `^1.15` | Task queue for GPU jobs | Arq, Dramatiq | Celery battle-tested; RQ simpler fallback; Arq/Dramatiq less widespread, minimal GPU usage examples. |
|  | PyTorch + CUDA Toolkit | `2.4` + `12.x` | Core training/inference runtime | TensorFlow, JAX | PyTorch’s ecosystem dominates LoRA, TTS, and diffusion; TensorFlow deprecated in most new models. |
| **Data Layer** | **PostgreSQL** | `16.x` | Relational data store | MySQL, MariaDB, SQLite | Postgres offers JSONB + full-text search, ideal for metadata-rich jobs; SQLite unsuitable for concurrency. |
|  | Redis | `7.x` | Caching, queue backend | Valkey, KeyDB | Redis ubiquitous, first-class BullMQ backend; Valkey is fork but early-stage. |
|  | MinIO | `RELEASE.2025-01-01T00-00-00Z` | S3-compatible object storage | Ceph, LocalFS | MinIO easy to deploy, perfect for local artifact storage; Ceph overkill. |
| **Monitoring & Ops** | **Prometheus** | `^3.0` | Metrics collection | InfluxDB, Graphite | Prometheus integrates natively with Grafana and Docker exporters. |
|  | Grafana | `^11.0` | Visualization dashboard | Superset, Kibana | Grafana excels at time-series visualization and alerting. |
|  | cAdvisor | `^0.47` | Container CPU/memory metrics | Node Exporter | cAdvisor exposes Docker metrics automatically, simpler for Compose. |
|  | NVIDIA DCGM Exporter | `^3.2` | GPU metrics exporter | nvtop, gpustat | DCGM integrates with Prometheus natively, official NVIDIA support. |
| **Ingress & Auth** | **Traefik v2** | `2.11` | Reverse proxy, TLS, routing | Nginx, Caddy | Traefik excels at dynamic container discovery and easy Let's Encrypt; fits Docker Compose natively. |

## 2️⃣ Versioning Policy
- **Pinned Base Images**: Every service Dockerfile references explicit tags (no `latest`) to maintain reproducibility.
- **Minor Upgrade Cadence**: Non-breaking updates applied quarterly after integration testing.
- **GPU Compatibility Window**: PyTorch and CUDA pinned per driver support (12.x baseline) for RTX 5070 Ti.
- **Schema Stability**: Postgres migrations managed via Prisma (TS) and Alembic (Py) for cross‑language safety.

## 3️⃣ Ecosystem Rationale
- **Full Open‑Source Stack**: All components (LLM, diffusion, TTS, orchestration, infra) have OSI licenses or equivalent permissive terms.
- **Local GPU Efficiency**: Each chosen framework runs inference/training efficiently on a single 16 GB card.
- **Observability by Design**: Metrics exposure required for every service; minimal runtime assumptions (no cloud dependencies).
- **Composability**: Each component replaceable with compatible API; e.g., Ollama ↔ LM Studio, ComfyUI ↔ Automatic1111 headless.

## 4️⃣ Optional Modules (Future Integration)
| Area | Candidate | Benefit |
|:------|:-----------|:----------|
| **Vector Indexing / RAG** | pgvector, Weaviate | Enable retrieval‑augmented video scripting or voice memory. |
| **Frontend GPU Demo** | WebGPU / Three.js | Showcase real‑time avatar rendering or shader filters. |
| **Auth / IAM** | Keycloak, Auth.js | Role‑based access for multiple users. |
| **Job Analytics** | Prometheus Pushgateway, Grafana Loki | Log + metrics correlation for pipeline profiling. |

---

### Summary
The stack balances modern developer ergonomics with strict open‑source compliance and single‑GPU practicality. Each layer was selected for **stability, community maturity, and ease of automation**, with well-defined alternatives documented for future flexibility.

