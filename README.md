# 🌀 MySpinBot

> _“Objectiveness is overrated, ditching it responsibly.”_

Welcome to **MySpinBot**, the open-source, fully local platform for generating short personalized AI videos of talking “bots” — the kind that spin their way through LoRA training, voice cloning, and lip-syncing, all while pretending not to melt your GPU.

Think of it as a creative factory where:

- You upload a few images and a short audio clip,
- It trains a mini-LoRA and a voice clone,
- Then it stitches everything together into a staged, narrated, lip-synced video —  
  — all **locally**, **privately**, and **under your control**.

I stole the idea from Computerphile’s [_MikeBot3000: Can We Build an AI Mike from Open Source Tools?_](https://www.youtube.com/watch?v=cP8xpkvs_UI) and used all the help I could get out of my trusty old pal **ChatGPT-5** to make it spin — figuratively, literally, and sometimes uncontrollably.

## 🧭 Project Overview

| Component                            | Purpose                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| **Frontend (Next.js 15)**            | User UI for uploads, prompts, and previews                  |
| **Backend (Fastify + LangGraph.js)** | Orchestrates jobs, LLM prompts, and pipelines               |
| **GPU Worker (Python + LangGraph.py + Dramatiq)**  | Handles LoRA, TTS, and video generation                     |
| **ComfyUI Engine**                   | Diffusion/video workflows (SD 1.5 / SDXL / SVD / SadTalker) |
| **Ollama LLM Host**                  | Stage + narrative generation using local models             |
| **Distributed Computing Framework**                  | Abstractions over Redis Streams and Pub/Sub |
| **Persistence Layer**                       | PostgreSQL 16 + MinIO (S3)                        |
| **Ingress / TLS**                    | Traefik 2.11 routing for all subdomains                     |
| **Monitoring**                       | Prometheus 3 + Grafana 11 + cAdvisor + DCGM exporter        |

All modules are connected through a Docker Compose setup, forming a self-contained ecosystem that turns pixels and phonemes into performance.

## 📚 Documentation

The full set of project documents lives in [`/docs`](./docs) — they explain everything from _why this madness exists_ to _how it will be contained_.

Start [here](./docs/README.md).

## 🧱 Current Status

| Phase      | Title                                  | Status       |
| :--------- | :------------------------------------- | :----------- |
| 🧊 Subzero | Repo setup + docs freeze               | ✅ Completed |
| 0          | Infra Bootstrap (Traefik + Monitoring) | ✅ Completed |
| 1          | Backend & Frontend Scaffold            | ✅ Completed |
| 2          | GPU Worker Integration                 | ✅ Completed  |
| 3          | AI Pipeline Implementation             | 🕓 Pending   |
| 4          | Quality & Observability                | ⏳ Planned   |
| 5          | Polish & Docs                          | ⏳ Planned   |

## 🧠 Guiding Principles

- **Local-First.** No data leaves your machine.
- **Metrics-First.** Every container speaks Prometheus.
- **Open-Source.** Every dependency is transparent and replaceable.
- **GPU-Aware.** Jobs are serialized to protect your VRAM’s dignity.
- **Humor-Tolerant.** Because debugging diffusion pipelines without sarcasm is impossible.

## 🛠️ Upcoming Sections (to be expanded later)

- [ ] **Quick Start** – cloning, `.env` setup, and Compose run
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

Cryogenic sleep is over — the bot has twitched.
Phase 1 boots up, circuits warm, queues hum, and containers finally remember why they exist.

Brace yourself: the spin just went **interactive**.
May your API routes be fast, your Redis never block, and your GPU stay smugly at 42 °C.
