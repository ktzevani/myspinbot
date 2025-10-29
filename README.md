# 🌀 MySpinBot

> _“Objectiveness is overrated! We are ditching it responsibly.”_

Welcome to **MySpinBot**, the open-source, fully local platform for generating short personalized AI videos of talking “bots” — the kind that spin their way through LoRA training, voice cloning, and lip-syncing, all while pretending not to melt your GPU.

Think of it as a creative factory where:
- You upload a few images and a short audio clip,  
- It trains a mini-LoRA and a voice clone,  
- Then it stitches everything together into a staged, narrated, lip-synced video —  
— all **locally**, **privately**, and **under your control**.  

I stole the idea from Computerphile’s [_MikeBot3000: Can We Build an AI Mike from Open Source Tools?_](https://www.youtube.com/watch?v=cP8xpkvs_UI) and used all the help I could get out of my trusty old pal **ChatGPT-5** to make it spin — figuratively, literally, and sometimes uncontrollably.


This is **Phase Subzero**, where the project is still thawing. Only the documentation lives here (see [`/docs`](./docs)), but the architecture is already mapped and the road to Phase 0 (“Infra Bootstrap”) is paved with containers and dreams.

## 🧭 Project Overview

| Component | Purpose |
|------------|----------|
| **Frontend (Next.js 14)** | User UI for uploads, prompts, and previews |
| **Backend (Fastify + LangGraph.js)** | Orchestrates jobs, LLM prompts, and pipelines |
| **GPU Worker (Python + Celery/RQ)** | Handles LoRA, TTS, and video generation |
| **ComfyUI Engine** | Diffusion/video workflows (SD 1.5 / SDXL / SVD / SadTalker) |
| **Ollama LLM Host** | Stage + narrative generation using local models |
| **Data Layer** | PostgreSQL 16 + Redis 7 + MinIO (S3) |
| **Ingress / TLS** | Traefik 2.11 routing for all subdomains |
| **Monitoring** | Prometheus 3 + Grafana 11 + cAdvisor + DCGM exporter |

All modules are connected through a Docker Compose setup, forming a self-contained ecosystem that turns pixels and phonemes into performance.

## 📚 Documentation

The full set of project documents lives in [`/docs`](./docs).  
Start with these — they explain everything from *why this madness exists* to *how it will be contained*:

- `01_project_description.md` – the what and the why  
- `02_architecture_overview.md` – how the parts fit (and sometimes misfit)  
- `03_tech_stack.md` – what powers the chaos  
- `04_modular_breakdown.md` – what does what, and who’s to blame  
- `05_roadmap.md` – how we plan to get from subzero to showtime

## 🧱 Current Status

| Phase | Title | Status |
|:------|:------|:-------|
| 🧊 Subzero | Repo setup + docs freeze | ✅ Completed |
| 0 | Infra Bootstrap (Traefik + Monitoring) | 🕓 Pending |
| 1 | Backend & Frontend Scaffold | ⏳ Planned |
| 2 | GPU Worker Integration | ⏳ Planned |
| 3 | AI Pipeline Implementation | ⏳ Planned |
| 4 | Quality & Observability | ⏳ Planned |
| 5 | Polish & Docs | ⏳ Planned |

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

## 🧊 Closing Remark

This repo is currently in **cryogenic sleep**.  
Once Phase 0 begins, the real spin starts — literally and figuratively.

Stay tuned, stay cool, and may your VRAM always have room to breathe.
