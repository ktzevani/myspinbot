# ⚙️ Development, Debugging & Testing Guide (Phase 2)

This document defines the **development workflow** for MySpinBot as was shaped during Phase 2. It explains how development, debugging, and testing are performed across the workspaces of the three main subsystems:

* **Backend Workspace** (Node.js + Fastify + LangGraph.js)
* **Frontend Workspace** (Next.js 15 + React)
* **Worker Workspace** (Python GPU Worker + LangGraph.py + Dramatiq)

All infrastructure services (Traefik, Redis, Redis Insight, MinIO, Prometheus, Grafana, etc.) have been consolidated, under phase 2, into the **`infra/`** directory and run automatically during development.

This guide reflects the **new, unified Dev Container–based workflow**, where each module is developed in isolation inside its own VS Code Dev Container.

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
* Each module is worked on in isolation by opening its folder directly in VS Code.
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

Each workspace includes:

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
* Suppresses automatic execution of dev container entrypoints

## **Step 2 — Open the workspace sub-folder in VS Code**

You always open the **sub-project directory**, not the project root.

Examples:

* `myspinbot/backend`
* `myspinbot/frontend`
* `myspinbot/worker`

Once opened, VS Code detects `.devcontainer/` and prompts:

> **Reopen in Container**

Choose this to enter the isolated development environment.

## **Step 3 — Develop inside the subsystem’s Dev Container**

Once inside the Dev Container:

* All runtimes, dependencies, and tools are preconfigured[^1].
* Code edits are mirrored instantly (mounted volume).
* Debugging uses the sub-workspace's `.vscode/launch.json` configuration.
* Testing is executed via Test Explorer or terminal.
* Manual server or process startup is required.

[^1]: One may need to manually fetch deps and tools depending on the project dev state.

## **Step 4 — Rebuild the Dev Container when environment changes**

If you update dependencies, Dockerfiles, or `.devcontainer` settings:

* Use VS Code → **Dev Containers: Rebuild and Reopen in Container**

This rebuilds only the dev container you are working on.

## **Step 5 — Stop the development stack**

Match the shutdown command to the startup:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml [--profile <name>] down
```

This ensures a clean and accurate teardown.

# 4. Backend Workspace

### Execution

Backend needs manual invocation to start the backend server, you can do this via the preconfigured launch configuration. Before this though, you will also need to run the preconfigured VS code task upon dev container first initialization in order to acquire the necessary dependencies as a one-time action. 

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

The worker process needs to be invoked manually or either from the related launch configuration option. 

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

Infrastructure services under `infra/` run automatically in production mode since they are not redifined in the dev compose overlay:

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