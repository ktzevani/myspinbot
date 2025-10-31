# ⚙️ Workflow Guide

## 🧑‍💻 Local Development Workflow

During Phase 1, both the **backend** (Fastify) and **frontend** (Next.js) are designed to be developed and tested **outside Docker** for faster feedback loops and easier debugging.

### 🔹 Environment Setup
1. Install Node 20 LTS on your machine.  
2. Inside each service directory, install dependencies:  
   
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
3. Create a local environment file for the frontend:  
   
   ```bash
   # frontend/.env.local
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

### 🔹 Running Services Locally
| Component | Command | Local URL | Description |
|------------|----------|------------|--------------|
| **Backend** | `npm run start` (in `backend/`) | <http://localhost:3000/health> | Starts Fastify server and exposes health + metrics endpoints. |
| **Frontend** | `npm run dev` (in `frontend/`) | <http://localhost:3001/> | Starts Next.js dev server with hot reload. |

### 🔹 Workflow Summary
- Develop features directly with native Node / Next.js tools.  
- Hot-reload and inspect logs instantly.  
- No Traefik, Prometheus, or Grafana needed during normal iteration.  
- When you’re ready to validate full integration (routing, TLS, metrics), switch to the Compose stack:
 
  ```
  docker compose up -d --build api ui
  ```

### 🔹 Philosophy
> **Local for speed, Docker for truth.**  
> Keep development fluid and responsive, then confirm correctness and integration inside the full container ecosystem.

## 🧪 Integration Testing Workflow

Once local development is stable, use the Docker Compose environment to test how all components interact inside the full MySpinBot stack.

### 🔹 Pre-requisites
- Phase 0 infrastructure (Traefik, Prometheus, Grafana) already running.  
- Domain names like `api.myspinbot.local` and `ui.myspinbot.local` resolvable via `/etc/hosts` or custom DNS.

### 🔹 Commands
1. Build and start the stack:  
   
   ```
   docker compose up -d --build api ui
   ```
2. Verify routing:
   - `https://api.myspinbot.local/health` → returns `{ "status": "ok" }`
   - `https://ui.myspinbot.local` → loads dashboard showing backend health  
3. Check metrics:
   - Visit `https://prometheus.myspinbot.local` → confirm `myspinbot-api` target is up  
   - View Grafana dashboard *Backend & Frontend Overview*

### 🔹 Validation Checklist
| Check | Expected Outcome |
|-------|------------------|
| API health | JSON `{status:"ok"}` |
| Prometheus target | `myspinbot-api` listed and healthy |
| Grafana panel | Displays backend uptime and request rate |
| TLS routing | Traefik serves both domains with valid local certs |

### 💡 Notes
- These containers use **production-like builds** (`npm ci --omit=dev`), ensuring your runtime environment matches deployment.  
- Logs can be inspected via:  
  
  ```
  docker compose logs -f api
  docker compose logs -f ui
  ```
-  Integration mode validates what local mode cannot — TLS, routing, metrics, and orchestration.  

## 💡 Supported Node Versions

MySpinBot is developed and tested with modern LTS Node.js releases. **Node 20 LTS or newer** can be safely used — including **Node 22 LTS** — for local development.

### 🔹 Local Environment
- **Recommended:** Node 22 LTS (e.g., v22.20.0)  
- **Also supported:** Node 20 LTS  
- Both Fastify 4.x and Next.js 14 fully support these versions.  
- Node 22 includes the built-in `fetch()` API and improved performance; no compatibility issues exist for this stack.

### 🔹 Docker Environment
- Docker images currently use `node:20-alpine` for reproducibility and stability.  
- We can upgrade to `node:22-alpine` later when it becomes the default `node:lts` tag.
