# 🧠 Debugging the Next.js Frontend

This guide explains how to debug and inspect the **MySpinBot frontend** during local development.

## 1️⃣ Browser DevTools (Primary Tool)

The browser is your main debugging environment for React and Next.js apps.

### 🔹 Open DevTools
Press **F12** or **Ctrl + Shift + I** (Windows/Linux) or **Cmd + Opt + I** (macOS).

### 🔹 Key Tabs

| Tab | Purpose |
|------|----------|
| **Console** | View `console.log()` and errors. |
| **Network** | Inspect API requests (e.g., `/health`). Filter by *Fetch/XHR*. |
| **Sources** | Step through code, set breakpoints, inspect variables. |
| **Components (⚛ React DevTools)** | Explore the React tree, props, and state. |

> 💡 Install the **React Developer Tools** browser extension.  
> It adds “⚛ Components” and “⚛ Profiler” tabs for debugging React.

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

| Method | Purpose | Tool / Command |
|---------|----------|----------------|
| **Browser DevTools** | Inspect console, network, sources | F12 |
| **React DevTools** | Examine React tree and state | Browser extension |
| **VS Code Debugger** | Breakpoints + step debugging | Add `launch.json`, F5 |
| **console.log / debugger** | Quick inline inspection | In code |
| **curl / Network tab** | Verify API calls | `curl -v http://localhost:3000/health` |

> 💡 Combine browser DevTools for runtime inspection and VS Code debugging for full control of breakpoints and state.
