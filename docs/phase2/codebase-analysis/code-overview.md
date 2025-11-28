# Codebase Extract (Phase 2)

Scope: Summary of code (excluding docs/) to feed into gpt-5.1 for documentation.

## System shape
- Control-plane backend (Node/Fastify) orchestrates LangGraph workflows, exposes HTTP+WS, and persists job state in Redis.
- Worker plane (Python/FastAPI) consumes graphs from Redis Streams, executes python-plane nodes, and publishes progress/status/data back.
- Frontend (Next.js) triggers training and streams status updates via WebSocket.
- Shared JSON schemas in `common/` drive validators/datamodels; codegen scripts keep backend/worker in sync.
- Infra via docker-compose: Traefik proxy, Redis, MinIO, Prometheus/Grafana/cAdvisor/DCGM.

## Control-plane backend (backend/)
- Entry: `backend/src/index.js` sets up Fastify + CORS, registers HTTP and WS routes on port 3000.
- Config: `backend/src/config.js` loads `backend/config/*.json` (merged with redis bridge) and validates with AJV validators; exposes `getConfiguration` and `getCapabilities`.
- HTTP routes (`backend/src/api/http`):
  - `GET /health` returns ok.
  - `GET /metrics` exposes Prometheus registry (`infra/metrics.js`).
  - `GET /api/capabilities` builds a two-node graph (worker get_capabilities -> control capabilities.getManifest) and returns combined manifest output.
  - `GET /api/status/:jobId` fetches job state from Redis.
  - `POST /api/train` creates a new graph via `Planner`, enqueues to control stream via `jobQueue.enqueueControlJob`.
- WebSocket route (`/ws`): uses `infra/websocket.js`; clients SUBSCRIBE/UNSUBSCRIBE by jobId; server polls registered handlers (`jobQueue.getJobState`) and pushes `{type:"update", ...state}` on interval `configuration.websocket.updateInterval`. Metrics recorded for connections/messages.
- JobQueue (`backend/src/core/job-queue.js`): wraps ioredis. Manages consumer groups, enqueues control/data jobs to `${bridge.streams.process}:{control|data}`, persists job:<id> keys (status/progress/graph), subscribes to worker pub/sub channels to mirror updates. Publishes status/progress/data events.
- Planner (`backend/src/core/planner.js`): builds default LangGraph template (script -> post-script -> train_lora) or supplied template, validates with LangGraph Graph + AJV schema (`validators/langgraph/graph.schema-validator.cjs`), serializes job graph with metadata version `langgraph.v1`.
- Executor (`backend/src/core/executor.js`): control-plane graph runner for plane:"node" nodes. Polls control stream, validates graph, executes ready control nodes via `servicesRegistry` handlers; writes outputs back into graph, updates progress, persists payload, publishes status. If any python-plane nodes remain, hands off updated graph to data stream for worker; otherwise marks completed/failed.
- Services registry autoloads functions from `backend/src/services/*.js`:
  - `capabilities.getManifest`: merges control-plane capabilities with worker-provided manifest, optionally publishes data.
  - `artifacts.uploadArtifact`/`prepareAssets`: stubs for MinIO artifacts.
  - `script.generateScript`: simulated progress, returns dummy payload (LLM call stubbed out).
- Validators: generated AJV validators under `backend/src/validators/**` from JSON schemas in `common/`.
- Tests: Vitest specs under `backend/tests/*` cover websocket, queue, status, metrics, health.

## Worker plane (worker/)
- App: FastAPI (`worker/src/worker/main.py`) with lifespan that connects RedisBridge and starts Executor; routes: `/health`, `/metrics`.
- Config: `worker/src/worker/config.py` merges `/app/config/{config.json,redis.bridge.json}` with env-provided MinIO creds; caches `WorkerConfiguration` (Pydantic). `get_capabilities` loads `config/capabilities.json`.
- RedisBridge (`worker/src/worker/core/bridge.py`): async Redis wrapper mirroring control-plane JobQueue. Creates consumer group, polls `${streams.process}:data`, acks entries, persists job payloads with TTL, can enqueue graphs back to control stream, publishes progress/status/data via pub/sub channels.
- Executor (`worker/src/worker/core/executor.py`): polls bridge for jobs, validates LangGraph payload with Pydantic models (`models/langgraph/graph_schema.py`), ensures workflowId == jobId, publishes running status, executes python-plane nodes in dependency order. Each node handler receives params + input and progress/data callbacks; outputs merged into graph; on completion publishes status/graphs or hands off; records Prometheus metrics via `infra/metrics`.
- Tasks (`worker/src/worker/services/tasks.py`): registry via `@task` decorator.
  - `train_lora`, `train_voice`, `render_video` simulate work: upload dummy artifact to MinIO (creates bucket if missing), emit progress over time.
  - `get_capabilities` returns worker capability manifest JSON string from config.
  - Helpers: `connect_minio`, `simulate_progress`, `upload_dummy_artifact`.
- Models/schemas: Pydantic dataclasses under `worker/src/worker/models/**` generated from `common/` JSON schemas (jobs/langgraph/capabilities/redis/storage). Provide enums (JobStatus, Plane, NodeStatus, etc.).
- Metrics: Prometheus registry in `worker/src/worker/infra/metrics` with helpers `get_or_create_metric`; metrics endpoint uses `prometheus_client.generate_latest`.

## Shared schemas and codegen
- Canonical JSON Schemas live in `common/config/schemas/**` (langgraph graph, job messaging, capabilities, redis config, artifacts).
- Codegen scripts `codegen/gen-backend-validators.sh` and `codegen/gen-worker-datamodel.sh` regenerate AJV validators and Pydantic models from shared schemas (via `codegen/gen-all.sh`).
- Config baselines duplicated in `common/config/redis.bridge.json` etc.; backend/worker copy into their `config/` directories and validate on load.

## Frontend (frontend/)
- Next.js app (app router). Page (`app/page.tsx`) renders `UploadForm` and a list of `StatusCard`s.
- API client (`lib/api.ts`): `postTrain` posts to `${API_BASE}/api/train` (API base from `NEXT_PUBLIC_API_URL` or https://api.myspinbot.local), returns job stub; `wsUrl` derives WS endpoint.
- WebSocket hook (`lib/ws.ts`): maintains WS connection to `/ws`, handles SUBSCRIBE/UNSUBSCRIBE actions, retries with backoff, forwards `{type:"update"}` messages to caller.
- Components:
  - `UploadForm` collects image + prompt, calls `postTrain`, seeds job list.
  - `StatusCard` shows status pill, prompt, progress bar; unsubscribes once status reaches completed.
  - `ProgressBar` renders normalized progress.
- Tests: Vitest + React Testing Library in `frontend/tests/*` for components/hook behavior.

## Key runtime flows
- Training flow: client POST `/api/train` -> backend Planner produces control graph -> `jobQueue.enqueueControlJob` seeds control stream -> backend Executor runs control-plane nodes (script/post-script) -> if python-plane nodes remain, graph pushed to data stream -> worker Executor runs python nodes (train_lora etc.), publishes progress/status/data via Redis pub/sub -> backend JobQueue persists keys and WS pushes updates -> frontend updates UI.
- Capabilities flow: `GET /api/capabilities` builds two-node graph (worker get_capabilities -> control merge) and returns combined manifest from resulting graph payload.
- WebSocket updates: clients subscribe per jobId; backend polls jobQueue handler on interval and emits consolidated state; unsubscribes automatically when job reaches completed.
- Observability: both planes expose `/metrics` (Prometheus format). Grafana/Prometheus/cAdvisor/DCGM composed in `docker-compose.yml`; Traefik fronts services; MinIO used for artifact stubs; Redis is central queue + pub/sub.

## Pointers for documentation
- Emphasize dual-plane LangGraph execution (control-plane = node tasks, worker-plane = python tasks) mediated via Redis Streams and pub/sub.
- Call out schema-driven approach (common schemas -> validators/models) and the default graph template used by Planner.
- Note current stubs (script generation, artifact handling) and simulated progress; real implementations would replace stubs while keeping callbacks/metrics contracts.
- Configuration touchpoints: API/WS host/port, CORS origins, Redis bridge config, MinIO env overrides, websocket update interval, job TTLs.
