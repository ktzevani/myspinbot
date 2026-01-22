# Tech Stack Overview

This document lists the core technologies used in MySpinBot as implemented today design choices. The stack has evolved iteratively, see [history](./06_history.md).

## ⚙️ Stack Snapshot

### Core Components

| Layer                     | Component / Library             | Used In               | Role                                                                                          |
| ------------------------- | ------------------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| **Frontend**              | Next.js 15 + React + TypeScript | `frontend/`           | Single-page UI for training requests and job progress visualization.                          |
|                           | TailwindCSS + shadcn/ui         | `frontend/`           | Styling, layout, and basic UI components.                                                     |
| **Backend (Control)**     | Node.js 20                      | `backend/`            | Runtime for the control plane (Fastify, LangGraph.js, Redis clients).                         |
|                           | Fastify                         | `backend/`            | HTTP API, WebSocket endpoint, health & metrics.                                               |
|                           | LangGraph.js                    | `backend/`            | Graph creation and control-plane execution for `plane: "node"` nodes.                         |
|                           | `ioredis`                       | `backend/`            | Redis Streams and Pub/Sub client for the JobQueue.                                            |
|                           | AJV (generated validators)      | `backend/`            | Validates config, LangGraph graphs, and job messages against shared JSON Schemas.             |
|                           | `prom-client`                   | `backend/`            | Exposes `/metrics` endpoint for API, queue, and WebSocket metrics.                            |
| **Worker (Data Plane)**   | Python 3.13 + FastAPI           | `worker/`             | Lightweight API for `/health` and `/metrics`, worker lifecycle, and executor bootstrap.       |
|                           | LangGraph.py                    | `worker/`             | Executes `plane: "python"` nodes in LangGraph graphs.                                         |
|                           | Async Redis client              | `worker/`             | Implements Redis Streams bridge and Pub/Sub progress channels.                                |
|                           | Pydantic v2                     | `worker/`             | Generated data models for LangGraph graphs, job messages, and configuration.                  |
|                           | `prometheus_client`             | `worker/`             | Exposes `/metrics` with worker and job metrics.                                               |
|                           | MinIO Python SDK / S3 client    | `worker/`             | Uploads dummy artifacts (LoRA weights, videos) to MinIO.                                      |
|                           | PyTorch / ComfyUI               | `worker/`             | Dynamic import of ComfyUI and presence of Torch libraries enable the development of complex custom AI inference and training pipelines |
| **Shared / Tooling**      | JSON Schema                     | `common/`             | Canonical definitions for graphs, jobs, capabilities, and configuration.                      |
|                           | Codegen scripts                 | `infra/codegen/`      | Generate AJV validators (backend) and Pydantic models (worker) from shared schemas.           |
|                           | Provisioning scripts            | `scripts/`            | Automate the generation of secrets(credentials, certs) throughout the monorepo.               |
|                           | Downloader - Staging Data       | `infra/downloader`    | Automates the initialization of the AI facilities by fetching required data from the intenet  |
| **Base Infrastructure**   | Docker Compose                  | root + `infra/`       | Orchestrates infra, backend, frontend, and worker services (dev + prod variants).             |
|                           | Traefik 2                       | `infra/traefik`       | Reverse proxy, TLS termination, routing to backend/frontend/metrics endpoints.                |
| **Observability**         | Prometheus                      | `infra/prometheus`    | Metrics collection from backend, worker, and exporters.                                       |
|                           | Grafana                         | `infra/grafana`       | Metrics visualization and dashboards.                                                         |
|                           | Redis Exporter                  | `.`                   | Redis telemetry scraping facilities to be exposed to Prometheus                               |
|                           | cAdvisor                        | `.`                   | Container CPU/memory metrics for Prometheus.                                                  |
|                           | NVIDIA DCGM Exporter            | `.`                   | GPU metrics exporter for Prometheus.                                                          |
| **Storage/Persistence**   | Redis                           | `.`                   | Central coordination fabric (Streams + Pub/Sub) for both planes. Supports user management via GUI and exposes telemetry scraping facilities. |
|                           | Redis Insight                   | `infra/redis-insight` | Redis introspection/management UI for development.                                      |
|                           | MinIO                           | `infra/`              | S3-compatible object storage for artifacts and uploads.                                       |
|                           | PostgreSQL                      | `infra/postgres`      | PostgreSQL RDBMS with pgvector extension enabled.                                       |
|                           | pgAdmin                         | `infra/postgres`      | DB management GUI for postgres.                                       |
| **AI Facilities**         | Ollama                          | `.`                   | The popular server for open-source LLMs. |
|                           | OpenWebUI                       | `.`                   | LLM management facilities and prompting UI placed in front of ollama. |
|                           | ComfyUI                         | `infra/worker`        | The popular diffusion workbench that provides a GUI for visual programming/prototyping of ai workflows. |

### 🧠 AI Models Used

The following models are utilized by the implemented pipelines:

| Component | Role |
| :--- | :--- |
| **[Mistral 7B Instruct](https://ollama.com/library/mistral)** | General-purpose LLM for text generation and instruction following via Ollama. |
| **[Nomic Embed Text](https://ollama.com/library/nomic-embed-text)** | High-performance text embedding model for vector search and RAG. |
| **[F5-TTS v1 Base](https://huggingface.co/SWivid/F5-TTS)** | Core flow-based Text-to-Speech model for realistic voice synthesis. |
| **[Vocos Vocoder](https://huggingface.co/charactr/vocos-mel-24khz)** | Neural vocoder used to convert TTS latent output into high-fidelity audio. |
| **[Wan 2.1 InfiniTetalk](https://huggingface.co/Kijai/WanVideo_comfy)** | Specialized video-to-audio/speech synthesis model. |
| **[Wan 2.1 VAE](https://huggingface.co/Kijai/WanVideo_comfy)** | Latent space encoder/decoder for Wan-based video generation. |
| **[UMT5-XXL](https://huggingface.co/Kijai/WanVideo_comfy)** | Large-scale T5 text encoder for complex prompt understanding in video pipelines. |
| **[Wan 2.1 CLIP Vision](https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged)** | Visual feature extractor for image-conditioned video generation. |
| **[Wan 2.1 I2V 720p (14B)](https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged)** | High-resolution 14B parameter Image-to-Video foundation model. |
| **[LightX2V Distill](https://huggingface.co/Kijai/WanVideo_comfy)** | Rank-64 distilled LoRA for faster 480p Image-to-Video inference. |
| **[RealESRGAN x2](https://huggingface.co/ai-forever/Real-ESRGAN)** | Enhancement model for upscaling images and video frames. |
| **[CodeFormer](https://huggingface.co/fofr/comfyui)** | AI-driven face restoration and detail enhancement for generated human subjects. |

These models are downloaded the first time the infrastructure gets up during the one-time initialization step defined by the `downloader` sidecar.

## 🧭 Quick Navigation

➡️ [Go to Modules Breakdown](./04_modular_breakdown.md)  
⬅️ [Back to Architecture Overview](./02_architecture_overview.md)