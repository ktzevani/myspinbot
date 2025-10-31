# 🧩 Backend & Frontend Implementation  

## 🎯 Objective  

Implement the foundational **Backend (Fastify)** and **Frontend (Next.js)** scaffolds introduced in Phase 1.  
These components form the operational spine of MySpinBot, bridging infrastructure (Traefik + Prometheus) with future AI pipelines (LangGraph → Ollama → ComfyUI).  


## 🧱 Service Overview  

| Service | Stack | Purpose | Exposed At | Observability |
|----------|--------|----------|-------------|----------------|
| **Backend** | Node 20 + Fastify + BullMQ + Redis | REST API and queue orchestrator; exposes `/health` and `/metrics` endpoints | `https://api.myspinbot.local` | Prometheus scrape target |
| **Frontend** | Next.js 14 + TypeScript + Tailwind + shadcn/ui | User interface and dashboard; communicates with API and visualizes status | `https://ui.myspinbot.local` | Optional client-side telemetry |

## 🧠 Architecture Note — Why Separate Backend & Frontend Images  

Although both services use Node.js, they serve **distinct roles** and thus benefit from **independent images**.  

| Rationale | Explanation |
|------------|-------------|
| **Different runtime profiles** | Backend handles API, queue, and metrics logic; frontend renders static and SSR pages. Separate ports, dependencies, and resource patterns. |
| **Independent build pipelines** | Backend changes shouldn’t trigger a full Next.js rebuild. Each image caches its own layers and uses the right base (e.g. `node:20-alpine` vs multi-stage build → `nginx:alpine`). |
| **Security separation** | Backend stays on the internal network; frontend is public via Traefik. Enables distinct TLS/middleware policies. |
| **Deployment flexibility** | Allows scaling API independently, swapping UI builds, or offloading frontend to a CDN later. |
| **Observability** | Only backend exports `/metrics`. Distinct containers keep Prometheus and Grafana dashboards clean. |

➡️ In short: **modularity = maintainability + scalability + clarity**.  

## ⚙️ Backend Implementation  

### Initial Directory Layout  

```
backend/
├─ Dockerfile
├─ package.json
├─ src/
│  ├─ index.js           # Fastify bootstrap
│  ├─ routes/health.js   # /health endpoint
│  ├─ routes/metrics.js  # /metrics (Prometheus)
│  └─ controllers/
│      └─ queue.js       # Job handling stub
└─ .dockerignore
```

### Key Endpoints  
| Path | Description | Auth | Notes |
|------|--------------|------|-------|
| `/health` | Liveness + readiness probe | none | Returns `{status:"ok"}` |
| `/metrics` | Prometheus exposition | none | Uses `prom-client` |
| `/api/jobs` | (future) enqueue tasks | internal | BullMQ stub |

> 💡 **BullMQ Integration (Placeholder):**  
> BullMQ is already imported and initialized in a stub form to define queue structure,  
> but no Redis connection is required yet.  
> Actual queue functionality and Redis deployment arrive in **Phase 2**.

### Example `Dockerfile`  
```
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

## 💅 Frontend Implementation  

### Initial Directory Layout

```
frontend/
├─ Dockerfile
├─ next-env.d.ts
├─ next.config.mjs
├─ package.json
├─ tsconfig.json
├─ app/
│  ├─ globals.css
│  ├─ page.tsx
│  └─ layout.tsx
├─ components/
│  └─ StatusCard.tsx
├─ lib/
│  └─ api.ts
└─ .dockerignore
```

### Highlights  
- **Next.js 14 App Router** for modular routing  
- **Tailwind + shadcn/ui** styling  
- **Environment variable:**  
  ```
  NEXT_PUBLIC_API_URL=https://api.myspinbot.local
  ``` 
- **Dashboard:** Displays API health and Redis queue placeholder.  

### Example `Dockerfile`  

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

## 🧩 Compose Integration  

`docker-compose.yml` excerpt (Phase 1 addition):  

```yml
services:
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: myspinbot-api
    restart: unless-stopped
    networks: [internal-network]
    environment:
      - NODE_ENV=production
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.myspinbot.local`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls=true"
      - "traefik.http.services.api.loadbalancer.server.port=3000"

  ui:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: myspinbot-ui
    restart: unless-stopped
    networks: [internal-network]
    environment:
      - NEXT_PUBLIC_API_URL=https://api.myspinbot.local
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.ui.rule=Host(`ui.myspinbot.local`)"
      - "traefik.http.routers.ui.entrypoints=websecure"
      - "traefik.http.routers.ui.tls=true"
      - "traefik.http.services.ui.loadbalancer.server.port=3001"
```

## 📊 Monitoring Integration  

| Component | Metric Source | Target |
|------------|---------------|--------|
| **Backend** | `/metrics` | Prometheus scrape job → `myspinbot-api` |
| **Frontend** | N/A | optional browser telemetry in future |
| **Grafana** | New dashboard *“Backend & Frontend Overview”* | Displays API uptime, request rate, error ratio |

## 🧭 Next Steps  

1. Validate Compose build and network reachability.  
2. Verify Prometheus scrape for backend metrics.  
3. Add simple Grafana panel visualizing API uptime.  
4. Implement Redis queue stats placeholder on frontend.  

## 🧊 Closing Remark  

Phase 1 marks the **birth of structure** — the skeleton stands.  
It can speak (`api`), it can listen (`ui`), and soon, in Phase 2, it will start to **think**. 🧠🔥  
