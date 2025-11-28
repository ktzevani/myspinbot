# Codebase Risks & Weak Points (Phase 2)

Scope: Known flaws/soft spots across architecture and implementation (excluding `docs/`). Use this as input for a hardening pass.

## Architectural/system-level
- Minimal auth/tenant model: HTTP/WS endpoints (`backend/src/api/http/routes.js`, `/ws`) accept all callers; no API keys, authZ, or rate limits. Traefik config has no per-service auth beyond dashboard.
- Redis is single point of failure: no reconnect/backoff strategy in backend `job-queue` or worker `RedisBridge`; failures drop updates silently and jobs may stall without alerts.
- Dual-plane orchestration is optimistic: control-plane assumes worker will pick up graphs; no timeouts/retries/escalation when worker is absent or slow; `getJobResult` busy-waits in backend with no overall timeout.
- Schema-to-runtime drift risk: planner default graph/template hardcoded; no contract check that tasks in graphs exist in registries; missing capability/version negotiation between planes.
- Observability gaps: metrics exist but no tracing/structured logging; no alerting on job stuck states or pub/sub persistence failures.

## Backend (Node/Fastify)
- `script.generateScript` has unreachable real implementation: function returns dummy object early; progress publishing stub only, leading to incorrect outputs (`backend/src/services/script.js`).
- Job queue persistence/parsing lacks type safety: fields in `executor.#processJob` parsed manually; bad payloads lead to broad catch/ack failures without DLQ or retry counters.
- Control executor never stops redis connections: `jobQueue` and `executor` attach SIGTERM/SIGINT handlers but do not await redis quit; possible unflushed updates.
- WebSocket updates poll Redis via handlers instead of subscribing directly; interval push with no backpressure/heartbeat; failures are swallowed silently (`backend/src/infra/websocket.js`).
- Capabilities endpoint blocks on worker job completion without timeout: `getCapabilitiesManifest` enqueues job then waits on `getJobResult`; if worker missing, request hangs (`backend/src/api/http/capabilities-controller.js`).
- Planner validation superficial: `#buildGraph` TODO; no validation that tasks are registered; edges/nodes from templates can be inconsistent without detection.
- Artifact services are stubs; uploading/prepareAssets returns fake paths; callers might trust non-existent storage.
- Job status enum converted from schema; status string comparisons elsewhere are loose (e.g., `StatusCard` checks "done"), risking mismatch between backend statuses.

## Worker (Python/FastAPI)
- Task outputs unused: training tasks return nothing; backend never receives artifacts/IDs, so downstream nodes cannot consume produced assets.
- Progress/status emission assumes Redis keys pre-exist; `publish_progress` with stepping reads `job:<id>:progress` without default -> will throw if missing.
- Executor error handling can ack and then publish status with wrong reference: in `_run_loop` catch block references `result.job_id` even when result undefined.
- Capability task returns JSON string embedded in object; control merges without validating fields beyond schema; malformed worker manifest passes silently.
- MinIO usage: `connect_minio` pulls creds from env but buckets created per task without IAM/policy; no cleanup or preflight connectivity test; errors print but don’t set task failure output.
- RedisBridge lacks reconnection/backoff; any Redis hiccup stops progress publishing/polling.

## Frontend (Next.js)
- `postTrain` sends body "dummy" instead of multipart form; backend currently ignores payload, but real integration will fail to accept image/prompt (`frontend/lib/api.ts`).
- Status handling mismatch: UI treats completion as `JobStatus.COMPLETED`, but also checks `job.status === "done"` for result links; diverges from backend enum values.
- No user feedback for websocket disconnect/retries; backoff logs but UI not informed.
- No validation/sanitization of prompt/file client-side beyond empty checks; large files/invalid types unhandled.

## Shared schemas/codegen
- Codegen commands assume dev environment with bash/docker; no guardrails or documentation for Windows users; generated files checked in, risking drift if not regenerated.
- Schemas permissive: capability/langgraph schemas allow extra fields by default in worker models (Pydantic Config extra=allow/forbid varies), leading to inconsistent validation between planes.

## Infra & deployment
- docker-compose lacks resource limits; Redis/MinIO/GPU services can starve host under load.
- No TLS/secret management beyond Traefik placeholders; `.env` referenced by Grafana, but secrets not rotated; MinIO creds default to admin/password unless env provided.
- No liveness/readiness probes for backend/worker containers; orchestrator cannot detect stuck processes.

## Testing gaps
- Backend/frontend tests exist but do not cover Redis/stream flows or worker integration; no E2E covering dual-plane handoff.
- No load/soak tests for websocket or job queue behavior; progress/status correctness unverified under parallel jobs.
- Worker tasks/tests absent; failure paths (MinIO down, Redis down) not exercised.
