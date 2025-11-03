# 🧩 Backend & Frontend Implementation

## 🎯 Objective

Implement the foundational **Backend (Fastify)** and **Frontend (Next.js)** scaffolds and extend them with **Redis job queues**, **WebSocket progress**, and **round-trip UI integration**.
These components form the operational spine of MySpinBot, bridging infrastructure (Traefik + Prometheus) with future AI pipelines (LangGraph → Ollama → ComfyUI).

## 🧱 Service Overview

| Service      | Stack                                          | Purpose                                                      | Exposed At                    | Observability                                 |
| ------------ | ---------------------------------------------- | ------------------------------------------------------------ | ----------------------------- | --------------------------------------------- |
| **Backend**  | Node 20 + Fastify + BullMQ + Redis             | REST API, job orchestrator, metrics & WebSocket events       | `https://api.myspinbot.local` | Prometheus scrape target                      |
| **Frontend** | Next.js 15 + TypeScript + Tailwind + shadcn/ui | User interface for uploads, status tracking, and job control | `https://ui.myspinbot.local`  | Client telemetry (future)                     |
| **Redis**    | Redis 7                                        | Queue & pub/sub backbone for BullMQ                          | internal                      | `redis.myspinbot.local` (optional Insight UI) |

## 🤖 Architecture Rationale

While both backend and frontend share Node.js roots, their runtime patterns diverge. Keeping them separate maintains clarity and scalability.

| Rationale              | Explanation                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| **Runtime profiles**   | Backend handles APIs, metrics, WebSocket connections; frontend handles SSR & static delivery. |
| **Independent builds** | Avoids full Next.js rebuild on API changes; distinct caching and image layers.                |
| **Security isolation** | Backend limited to internal network; frontend exposed via Traefik with TLS.                   |
| **Deployability**      | Each component can scale or redeploy independently.                                           |
| **Observability**      | Backend exports Prometheus metrics cleanly separated from frontend telemetry.                 |

---

## 🔧 Backend Implementation

### Initial Directory Layout

```
backend/
├─ Dockerfile
├─ package.json
├─ src/
│  ├─ index.js           # Fastify bootstrap
│  ├─ routes/
│  │  ├─ health.js       # /health endpoint
│  │  ├─ metrics.js      # /metrics endpoint
│  │  ├─ train.js        # POST /api/train
│  │  ├─ generate.js     # POST /api/generate
│  │  ├─ status.js       # GET /api/status/:id
│  │  └─ ws.js           # /ws WebSocket gateway
│  ├─ controllers/
│  │  ├─ jobController.js # job creation + updates
│  ├─ plugins/
│  │  ├─ redis.js        # BullMQ connection
│  │  ├─ metrics.js      # Prometheus registry
│  │  └─ websocket.js    # WS plugin registration
│  └─ workers/
│     ├─ trainWorker.js  # mock job execution
│     ├─ generateWorker.js
└─ .dockerignore
```

### Key Endpoints

| Path              | Description                     | Notes                                    |
| ----------------- | ------------------------------- | ---------------------------------------- |
| `/health`         | Liveness + readiness probe      | `{status:"ok"}`                          |
| `/metrics`        | Prometheus metrics              | default + queue stats                    |
| `/api/train`      | Enqueue LoRA training (mock)    | Accepts `{images, voice}`                |
| `/api/generate`   | Enqueue video generation (mock) | Accepts `{prompt}`                       |
| `/api/status/:id` | Job progress lookup             | Returns `{progress, state}`              |
| `/ws`             | WebSocket stream                | Emits `progress`, `done`, `error` events |

### BullMQ Integration

> The Redis connection is initialized from `REDIS_URL=redis://redis:6379`.
> Both `trainQueue` and `generateQueue` use BullMQ.
> Each worker simulates job progress and emits updates via WS.

## 🔗 WebSocket + Progress Flow

1. UI submits job (POST `/api/train` or `/api/generate`)
2. Fastify enqueues job in Redis queue
3. Worker picks up job and simulates work
4. Worker publishes progress to Redis pub/sub
5. Fastify WS server broadcasts events to connected clients
6. UI receives updates and updates progress UI

## 🖌️ Example Dockerfile (Backend)

```
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

## 🖌️ Frontend Implementation

### Initial Directory Layout

```
frontend/
├─ Dockerfile
├─ package.json
├─ next-env.d.ts
├─ tsconfig.json
├─ app/
│  ├─ globals.css
│  ├─ page.tsx
│  └─ layout.tsx
├─ components/
│  ├─ StatusCard.tsx
│  ├─ UploadForm.tsx
│  └─ ProgressBar.tsx
├─ lib/
│  ├─ api.ts        # REST helpers
│  └─ ws.ts         # WebSocket hook
└─ .dockerignore
```

### Features

- Dashboard displays health + job list.
- Upload form for images/audio and text prompts.
- Live job progress via WebSocket.
- API config from `NEXT_PUBLIC_API_URL`.
- Tailwind + shadcn/ui styling.

### Example Dockerfile

```
# Build stage
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package*.json ./
RUN npm ci --omit=dev
EXPOSE 3001
CMD ["npm", "run", "start"]
```

## 📊 Monitoring Integration

~~
| Component | Metric Source | Target |
| ------------ | ------------------------------------ | ----------------------------- |
| **Backend** | `/metrics` | Prometheus scrape |
| **Redis** | queue stats | optional exporter (Phase 2) |
| **Frontend** | none (for now) | client metrics optional |
| **Grafana** | Dashboard: _Backend & Frontend_ | job rate, WS clients, latency |
