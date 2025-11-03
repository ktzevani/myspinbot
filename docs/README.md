# 🧭 MySpinBot Documentation Index

> _"Objectiveness is overrated, ditching it responsibly."_  
> — MySpinBot Project Motto

Welcome to the **MySpinBot** documentation hub.  
This directory contains all design, architecture, and implementation documents for the project — from high-level concepts to infrastructure deployment and beyond.

## 📚 Core Documentation Series

| No. | Title                                                | Purpose                                                           |
| :-: | :--------------------------------------------------- | :---------------------------------------------------------------- |
| 01  | [Project Description](01_project_description.md)     | What MySpinBot is, its purpose, goals, and philosophy.            |
| 02  | [Architecture Overview](02_architecture_overview.md) | System topology, workflows, and high-level data flow.             |
| 03  | [Tech Stack](03_tech_stack.md)                       | Detailed component list, languages, frameworks, and dependencies. |
| 04  | [Modular Breakdown](04_modular_breakdown.md)         | How the system is organized into logical and functional modules.  |
| 05  | [Roadmap](05_roadmap.md)                             | Chronological development plan and phase progression.             |

## ⚙️ Implementation Phases

Each phase corresponds to a concrete implementation milestone — moving from foundational infrastructure to advanced AI workflows.

| Phase | Name                                                     | Status      | Description                                                             |
| :---- | :------------------------------------------------------- | :---------- | :---------------------------------------------------------------------- |
| 0     | [Infrastructure Bootstrap](phase0/phase0_overview.md)    | ✅ Complete | Traefik + Prometheus + Grafana stack with TLS, monitoring, and metrics. |
| 1     | [Backend & Frontend Scaffold](phase1/phase1_overview.md) | ✅ Complete | Node.js Fastify API + Next.js frontend + Redis queue.                   |
| 2     | [GPU Worker Integration](phase2/phase2_overview.md)      | 🕓 Pending  | Python worker (Celery/RQ) with GPU task orchestration.                  |
| 3     | AI Pipeline Implementation                               | ⏳ Planned  | LLM → ComfyUI → TTS → Lip-Sync video generation pipeline.               |
| 4     | Observability & Quality                                  | ⏳ Planned  | ESRGAN, retries, metrics dashboards, CI hooks.                          |
| 5     | Polish & Docs                                            | ⏳ Planned  | Authentication, UX refinement, public documentation.                    |

## 🗂 Phase 0 Reference (Infrastructure)

| Document                                            | Purpose                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| [phase0_overview.md](phase0/phase0_overview.md)     | Overview and deployment guide for the base infrastructure stack. |
| [traefik_guide.md](phase0/traefik_guide.md)         | Traefik configuration, secrets, and certificate management.      |
| [prometheus_guide.md](phase0/prometheus_guide.md)   | Prometheus setup and metrics configuration.                      |
| [grafana_guide.md](phase0/grafana_guide.md)         | Grafana provisioning, `.env` setup, and dashboards.              |
| [runtime_dirs.md](phase0/runtime_dirs.md)           | Explanation of runtime data directories and Git policies.        |
| [directory_summary.md](phase0/directory_summary.md) | Summary table linking all Phase 0 docs and READMEs.              |

## 🧩 Phase 1 Reference (Backend & Frontend Scaffold)

| Document                                                          | Purpose                                                                                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [phase1_overview.md](phase1/phase1_overview.md)                   | High-level plan and scope of the backend & frontend scaffolding phase.                                                        |
| [implementation_details.md](phase1/implementation_details.md)     | Implementation details for Fastify (API) and Next.js (UI) services.                                                           |
| [container_infrastructure.md](phase1/container_infrastructure.md) | Docker Compose topology, Traefik routing, and monitoring integration.                                                         |
| [development_workflow.md](phase1/development_workflow.md)         | Local development and integration testing workflows. With step-by-step guide for debugging both backend and frontend.         |
| [jobs_and_ws.md](phase1/jobs_and_ws.md)                           | Details on architecture of asynchronous job execution and real-time UI update.                                                |
| [testing_and_workspace.md](phase1/testing_and_workspace.md)       | Description of the unified VSCode workspace environment making testing, debugging and formatting seamless across the project. |
| [ui_and_basic_workflow.md](phase1/ui_and_basic_workflow.md)       | Details on basic workflow with an overview of frontend architecture.                                                          |

## 💬 Contributing to Documentation

1. Keep all conceptual docs (`01_…05_…`) in root `docs/` — they define _what_ and _why_.
2. Place all phase-specific operational docs under `docs/phaseX/`.
3. Use plain Markdown; keep formatting simple and readable on GitHub.

## 🧭 Quick Navigation

➡️ [Go to Phase 0 Overview](phase0/phase0_overview.md)  
⬅️ [Back to Repository Root](../README.md)
