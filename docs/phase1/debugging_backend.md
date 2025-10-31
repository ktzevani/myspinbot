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
      target: 'pino-pretty',
      options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' }
    }
  }
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
app.addHook('onRequest', async (req, reply) => {
  app.log.info({ method: req.method, url: req.url }, 'incoming request');
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

| Method | Purpose | Command / Setup |
|--------|----------|----------------|
| **pino-pretty logs** | Readable runtime output | Install `pino-pretty`; update Fastify logger |
| **console.log** | Quick variable inspection | Add inline prints |
| **Node inspector** | Step debugging | `node --inspect-brk src/index.js` |
| **VS Code** | Full IDE debugging | Add `launch.json` |
| **curl -v** | Inspect headers | `curl -v http://localhost:3000/health` |

> 💡 Combine detailed logs and breakpoints for the best of both worlds.  
> Pretty logs for flow context — breakpoints for fine-grained analysis.
