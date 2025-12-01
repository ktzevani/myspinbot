# ⚙️ Development, Debugging & Testing Guide (Phase 2)

This document defines the **development workflow** for MySpinBot as was shaped during Phase 2. It explains how development, debugging, and testing are performed across the three main subsystems:

* **Backend Workspace** (Node.js + Fastify + LangGraph.js)
* **Frontend Workspace** (Next.js 15 + React)
* **Worker Workspace** (Python GPU Worker + LangGraph.py + Dramatiq)

All infrastructure services (Traefik, Redis, Redis Insight, MinIO, Prometheus, Grafana, etc.) have been consolidated, in this phase, into the **`infra/`** directory and run automatically during development.

This guide reflects the **new, unified Dev Container–based workflow**, where each subsystem is developed in isolation inside its own VS Code Dev Container.

# 1. Architecture Overview

MySpinBot supports two operational modes:

## **Production Mode**

Minimal, optimized deployment:

```sh
docker compose -f docker-compose.yml up -d
```

Uses `myspinbot-<service>:prod` images.

## **Development Mode**

Full-featured development stack:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Uses `myspinbot-<service>:dev` images and automatically launches into Dev Container workflows.

In development mode:

* Backend, frontend, and worker each run inside dedicated **Dev Containers**.
* Each subsystem is worked on in isolation by opening its folder directly in VS Code.
* Testing and debugging happen **inside** each Dev Container.
* Infrastructure is automatically started via `infra/`.

# 2. Directory Structure

```
myspinbot/
├── backend/
├── frontend/
├── worker/
├── infra/
│   ├── traefik/
│   ├── prometheus/
│   ├── grafana/
│   ├── redis/
│   ├── redis-insight/
│   ├── minio/
│   └── ...
├── docker-compose.yml
└── docker-compose.dev.yml
```

Each subsystem workspace includes:

```
.vscode/
.devcontainer/
.dockerignore
Dockerfile
```

# 3. Unified Development Workflow

The workflow is consistent across backend, frontend, and worker.

## **Step 1 — Start the development stack**

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

This launches:

* All infrastructure services under `infra/`
* Dev-layer containers for backend, frontend, and worker
* Automatic execution of subsystem entrypoints

## **Step 2 — Open the subsystem folder in VS Code**

You always open the **subsystem directory**, not the project root.

Examples:

* `myspinbot/backend`
* `myspinbot/frontend`
* `myspinbot/worker`

Once opened, VS Code detects `.devcontainer/` and prompts:

> **Reopen in Container**

Choose this to enter the isolated development environment.

## **Step 3 — Develop inside the subsystem’s Dev Container**

Once inside the Dev Container:

* All runtimes, dependencies, and tools are preconfigured.
* Code edits are mirrored instantly (mounted volume).
* Debugging uses the subsystem's `.vscode/launch.json`.
* Testing is executed via Test Explorer or terminal.
* No manual server or process startup is required.

The container entrypoint handles all runtime execution.

## **Step 4 — Rebuild the Dev Container when environment changes**

If you update dependencies, Dockerfiles, or `.devcontainer` settings:

* Use VS Code → **Dev Containers: Rebuild and Reopen in Container**

This rebuilds only the subsystem you are working on.

## **Step 5 — Stop the development stack**

Match the shutdown command to the startup:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml [--profile <name>] down
```

This ensures a clean and accurate teardown.


# 4. Backend Workspace

### Execution

Backend starts automatically from its Dev Container entrypoint—no manual commands required.

### Debugging

Available tools:

* VS Code debugger
* Console logs
* Redis Insight for Stream and Pub/Sub inspection
* Browser DevTools for WebSocket events
* Prometheus metrics endpoint

### Testing (Vitest)

Run inside the Dev Container:

```sh
npm test
```

Covers:

* API routing and handlers
* Redis Streams enqueue / ack flow
* LangGraph.js workflow behavior
* WebSocket status + progress propagation

# 5. Frontend Workspace

### Execution

Starts automatically via the Dev Container entrypoint.

### Debugging

* Browser DevTools
* React Developer Tools
* VS Code Debugger (Next.js)
* Network tab for WebSocket state

### Testing (Vitest + React Testing Library)

Run inside the Dev Container:

```sh
npm test
```

Covers:

* Component behavior
* File upload flow
* WebSocket-driven UI updates

# 6. Worker Workspace (Python + GPU)

### Execution

The Dev Container entrypoint launches:

* FastAPI metrics server
* Redis Streams polling loop
* Python worker (executor)

### Debugging

Inside the worker Dev Container:

* VS Code Python debugger
* `pdb` or debugpy
* Application logs
* `nvidia-smi` for GPU monitoring
* Redis Insight for Stream state
* Prometheus metrics

### Testing (pytest)

Run inside the Dev Container:

```sh
pytest
```

Covers:

* Pydantic schema validation
* Stream consumption
* Status + progress Pub/Sub emission
* Task execution behavior

# 7. Infrastructure Workspace

Infrastructure services under `infra/` run automatically in development mode:

* Traefik
* Redis + Redis Insight
* MinIO
* Prometheus + Grafana

Used primarily for:

* Observability
* Routing validation
* Monitoring worker and GPU health
* Inspecting queue and stream state

# 8. End-to-End Development Cycle

1. Start development environment with Compose override.
2. Open a subsystem folder in VS Code.
3. Reopen that folder in Dev Container.
4. Develop, debug, and test inside the container.
5. Rebuild the Dev Container if configuration changes.
6. Stop the stack using matching Compose command.

# 9. Key Advantages

* Identical development workflow across backend, frontend, and worker
* Zero host runtime dependencies
* Perfect parity between development and production environments
* Hot-reload and debugging fully containerized
* Isolated, reproducible testing environments
* Infrastructure neatly compartmentalized under `infra/`

# 10. Commands Reference

## Start development stack

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

## Stop development stack

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml [--profile <name>] down
```

## Run tests

Backend / Frontend:

```sh
npm test
```

Worker:

```sh
pytest
```