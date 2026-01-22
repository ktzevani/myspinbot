# 🌀 MySpinBot

> _“Objectiveness is overrated, ditching it responsibly.”_

Welcome to **MySpinBot**, the open-source, fully local platform for generating short personalized AI videos of talking “bots” — the kind that spin their way through LoRA training, voice cloning, and lip-syncing, all while pretending not to melt your GPU.

<div align="center">
  <img height=500 src="/docs/resources/myspinbot_sample.gif" />
</div>

Think of it as a creative factory where:

- You upload a few images and a short audio clip,
- It trains a mini-LoRA and a voice clone,
- Then it stitches everything together into a staged, narrated, lip-synced video —  
  — all **locally**, **privately**, and **under your control**.

I stole the idea from Computerphile’s [_MikeBot3000: Can We Build an AI Mike from Open Source Tools?_](https://www.youtube.com/watch?v=cP8xpkvs_UI) and used all the help I could get out of my trusty old pal **ChatGPT-5** to make it spin — figuratively, literally, and sometimes uncontrollably.

## 🧭 Project Overview

> Currently, README describes the target end‑state architecture; see `/docs` for phase‑by‑phase implementation status.

The system is split into a control plane (Node.js backend) and a data plane (Python worker), both running LangGraph graphs and exchanging job state via Redis Streams + Pub/Sub.

| Component                            | Purpose                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| **Frontend (Next.js 15)**            | User UI for uploads, prompts, and previews                  |
| **Backend (Fastify + LangGraph.js)** | Orchestrates jobs, LLM prompts, and pipelines               |
| **Worker (Python + LangGraph.py + Dramatiq)**  | Handles LoRA, TTS, and video generation                     |
| **ComfyUI Engine**                   | Diffusion/video workflows (SD 1.5 / SDXL / SVD / SadTalker) |
| **Ollama LLM Host**                  | Stage + narrative generation using local models             |
| **Distributed Computing Bridge**                  | Abstractions over Redis Streams and Pub/Sub |
| **Persistence Layer**                       | PostgreSQL 16 + MinIO (S3)                        |
| **Ingress / TLS**                    | Traefik 2.11 routing for all subdomains                     |
| **Monitoring / Observability**                       | Prometheus 3 + Grafana 11 + cAdvisor + DCGM exporter        |

All modules are connected through a Docker Compose setup, forming a self-contained ecosystem that turns pixels and phonemes into performance.

## 📚 Documentation

The full set of project documents lives in [`/docs`](./docs) — it explains everything from _why this madness exists_ to _how it will be contained_.

Start [here](./docs/README.md).

## 🚀 Quick Start

1. **Prerequisites**

   - Docker with Compose v2
   - NVIDIA drivers + NVIDIA Container Toolkit (for the Python GPU worker)
   - Local DNS or hostname setup so `*.myspinbot.local` resolves to your Docker host  
     _(see the Traefik / infra docs under `/docs/phase0` and `/docs/phase1` for options: `/etc/hosts`, wildcard DNS, mkcert, etc.)_

2. **Run the full stack (prod‑like)**

   ```bash
   docker compose --profile observability up --build
   ```

3. **Run dev app containers on top of the stack**

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up api ui worker sandbox
   ```

4. **Open the UI & dashboards**

   - Frontend: https://ui.myspinbot.local
   - API (health/status): https://api.myspinbot.local
   - Grafana: https://grafana.myspinbot.local
   - Prometheus: https://prometheus.myspinbot.local
   - MinIO Console: https://s3.myspinbot.local
   - Redis Insight: https://redis.myspinbot.local

## 🧱 Current Status

| Phase      | Title                                  | Status       |
| :--------- | :------------------------------------- | :----------- |
| 🧊 Subzero | Repo setup + docs freeze               | ✅ Completed |
| 0          | Infra Bootstrap (Traefik + Monitoring) | ✅ Completed |
| 1          | Backend & Frontend Scaffold            | ✅ Completed |
| 2          | Worker Integration & Dual-plane Orchestration | ✅ Completed  |
| 3          | AI Pipeline Implementation             | 🕓 Pending   |
| 4          | Quality & Observability                | ⏳ Planned   |
| 5          | Polish & Docs                          | ⏳ Planned   |

> See [`history.md`](./docs/06_history.md) for how the architecture evolved across development phases.

## 🧠 Guiding Principles

- **Local-First.** No data leaves your machine.
- **Metrics-First.** Every container speaks Prometheus.
- **Open-Source.** Every dependency is transparent and replaceable.
- **GPU-Aware.** Jobs are serialized to protect your VRAM’s dignity.
- **Humor-Tolerant.** Because debugging diffusion pipelines without sarcasm is impossible.

## 🛠️ Upcoming Sections (to be expanded later)

- [ ] **Configuration Guide** – environment variables and secrets
- [ ] **Architecture Diagram** – service topology (Mermaid + SVG)
- [ ] **Developer Guide** – contribution flow and linting
- [ ] **Monitoring Dashboards** – screenshots and metrics list
- [ ] **FAQ / Troubleshooting** – the “my GPU caught fire” section
- [ ] **License & Credits**

## 💬 Contributing

Contributions, ideas, and sarcastic bug reports are welcome.  
Open an issue, start a discussion, or send a pull request.  
Be kind — we’re all just trying to make our bots talk before the GPU fans hit Mach 3.

## ⚖️ License

This project is licensed under the **AGPL-3.0** License — see the [LICENSE](./LICENSE) file for details.

## 🚀 Closing Remark

Phase 3 is on its way, brace yourself: the spin just went **interactive**.
May your API routes be fast, your Redis never block, and your GPU stay smugly at 42 °C.
