# ⚙️ Development Workflow Guide

Contents:

- [Local Development](#-local-development)
- [Integration Testing](#-integration-testing-workflow)
- [Backend Debugging](#-debugging-the-fastify-backend)
- [Fontent Debugging](#-debugging-the-nextjs-frontend)

## 🧑‍💻 Local Development

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

| Component    | Command                         | Local URL                      | Description                                                   |
| ------------ | ------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| **Backend**  | `npm run start` (in `backend/`) | <http://localhost:3000/health> | Starts Fastify server and exposes health + metrics endpoints. |
| **Frontend** | `npm run dev` (in `frontend/`)  | <http://localhost:3001/>       | Starts Next.js dev server with hot reload.                    |

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
   - View Grafana dashboard _Backend & Frontend Overview_

### 🔹 Validation Checklist

| Check             | Expected Outcome                                   |
| ----------------- | -------------------------------------------------- |
| API health        | JSON `{status:"ok"}`                               |
| Prometheus target | `myspinbot-api` listed and healthy                 |
| Grafana panel     | Displays backend uptime and request rate           |
| TLS routing       | Traefik serves both domains with valid local certs |

### 💡 Notes

- These containers use **production-like builds** (`npm ci --omit=dev`), ensuring your runtime environment matches deployment.
- Logs can be inspected via:

  ```
  docker compose logs -f api
  docker compose logs -f ui
  ```

- Integration mode validates what local mode cannot — TLS, routing, metrics, and orchestration.

## 💡 Supported Node Versions

MySpinBot is developed and tested with modern LTS Node.js releases. **Node 20 LTS or newer** can be safely used — including **Node 22 LTS** — for local development.

### 🔹 Local Environment

- **Recommended:** Node 22 LTS (e.g., v22.20.0)
- **Also supported:** Node 20 LTS
- Both Fastify 4.x and Next.js 15 fully support these versions.
- Node 22 includes the built-in `fetch()` API and improved performance; no compatibility issues exist for this stack.

### 🔹 Docker Environment

- Docker images currently use `node:20-alpine` for reproducibility and stability.
- We can upgrade to `node:22-alpine` later when it becomes the default `node:lts` tag.

# 🧠 Debugging the Fastify Backend

This guide describes several ways to debug and inspect the **MySpinBot backend** during local development.

## 1️⃣ Enable Human-Readable Logging

Fastify uses **pino** for logging by default.  
You can make its output easier to read by enabling the `pino-pretty` transport.

### 🔹 Install

```bash
cd backend
npm install pino-pretty --save-dev
```

### 🔹 Modify `src/index.js`

Replace:

```js
const app = Fastify({ logger: true });
```

with:

```js
const app = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: { translateTime: "SYS:standard", ignore: "pid,hostname" },
    },
  },
});
```

This makes logs appear as:

```
[2025-10-31 14:21:17.123] INFO Server listening on port 3000
[2025-10-31 14:21:20.456] INFO GET /health 200 2ms
```

## 2️⃣ Use Classic `console.log()` Debugging

Add statements anywhere in your routes or controllers:

```js
console.log("debug: route reached", request.url, request.body);
```

For async code:

```js
try {
  // code
} catch (err) {
  console.error("caught error:", err);
}
```

This is fast and works in all environments.

## 3️⃣ Start Node in Inspect Mode

### ▶ CLI Mode

Launch Fastify with the Node inspector:

```bash
node --inspect-brk src/index.js
```

Output:

```
Debugger listening on ws://127.0.0.1:9229/xxxx
```

Then open Chrome → `chrome://inspect` → “Open dedicated DevTools for Node”.  
Set breakpoints, step through code, and inspect variables.

### ▶ VS Code Launch Configuration

Create `.vscode/launch.json` in the project root:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Fastify Backend",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/backend/src/index.js",
      "runtimeArgs": ["--inspect-brk"],
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}/backend"
    }
  ]
}
```

Press **F5** to start debugging with breakpoints directly in the IDE.

## 4️⃣ Log Request Details

Add a global hook for deeper request tracing:

```js
app.addHook("onRequest", async (req, reply) => {
  app.log.info({ method: req.method, url: req.url }, "incoming request");
});
```

Each incoming request is then logged with its method and URL.

## 5️⃣ Inspect Headers and CORS Behavior

Use `curl -v` to see full request and response headers:

```bash
curl -v http://localhost:3000/health
```

Check that the response includes:

```
Access-Control-Allow-Origin: http://localhost:3001
```

## 🧭 TL;DR Debug Toolkit

| Method               | Purpose                   | Command / Setup                              |
| -------------------- | ------------------------- | -------------------------------------------- |
| **pino-pretty logs** | Readable runtime output   | Install `pino-pretty`; update Fastify logger |
| **console.log**      | Quick variable inspection | Add inline prints                            |
| **Node inspector**   | Step debugging            | `node --inspect-brk src/index.js`            |
| **VS Code**          | Full IDE debugging        | Add `launch.json`                            |
| **curl -v**          | Inspect headers           | `curl -v http://localhost:3000/health`       |

> 💡 Combine detailed logs and breakpoints for the best of both worlds. Pretty logs for flow context — breakpoints for fine-grained analysis.

# 🧠 Debugging the Next.js Frontend

This guide explains how to debug and inspect the **MySpinBot frontend** during local development.

## 1️⃣ Browser DevTools (Primary Tool)

The browser is your main debugging environment for React and Next.js apps.

### 🔹 Open DevTools

Press **F12** or **Ctrl + Shift + I** (Windows/Linux) or **Cmd + Opt + I** (macOS).

### 🔹 Key Tabs

| Tab                               | Purpose                                                        |
| --------------------------------- | -------------------------------------------------------------- |
| **Console**                       | View `console.log()` and errors.                               |
| **Network**                       | Inspect API requests (e.g., `/health`). Filter by _Fetch/XHR_. |
| **Sources**                       | Step through code, set breakpoints, inspect variables.         |
| **Components (⚛ React DevTools)** | Explore the React tree, props, and state.                      |

> 💡 Install the **React Developer Tools** browser extension. It adds “⚛ Components” and “⚛ Profiler” tabs for debugging React.

## 2️⃣ Inline Logging and Debugger Statements

Use classic logging anywhere in your components:

```js
console.log("Health status:", status);
```

Trigger a breakpoint directly in code:

```js
if (status === "unreachable") debugger;
```

When DevTools are open, execution pauses on that line.

## 🧩 3️⃣ VS Code Debugging (Recommended)

### 🔹 Create `.vscode/launch.json`

In the repository root (or inside `frontend/`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Next.js Frontend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 9229,
      "cwd": "${workspaceFolder}/frontend",
      "console": "integratedTerminal"
    }
  ]
}
```

Press **F5** to start debugging.  
VS Code launches the Next.js dev server and attaches automatically — you can now set breakpoints in `.tsx` files.

## 4️⃣ Network & API Diagnostics

To verify the backend connection:

```bash
curl -v http://localhost:3000/health
```

Then in DevTools → **Network**, confirm:

- **Request URL:** `http://localhost:3000/health`
- **Status:** 200 OK
- **Response:** `{"status":"ok"}`

## 5️⃣ Hot Reload & Error Overlay

While running the dev server:

```bash
npm run dev -p 3001
```

Next.js automatically:

- Rebuilds and reloads on save.
- Displays in-browser overlays for syntax or runtime errors.

If reload stops working, restart the dev server with the command above.

## 🧭 TL;DR Debug Toolkit

| Method                     | Purpose                           | Tool / Command                         |
| -------------------------- | --------------------------------- | -------------------------------------- |
| **Browser DevTools**       | Inspect console, network, sources | F12                                    |
| **React DevTools**         | Examine React tree and state      | Browser extension                      |
| **VS Code Debugger**       | Breakpoints + step debugging      | Add `launch.json`, F5                  |
| **console.log / debugger** | Quick inline inspection           | In code                                |
| **curl / Network tab**     | Verify API calls                  | `curl -v http://localhost:3000/health` |

> 💡 Combine browser DevTools for runtime inspection and VS Code debugging for full control of breakpoints and state.
