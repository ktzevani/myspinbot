# 🧪 Testing & Workspace Integration

## 🎯 Objective

Establish a unified, developer-friendly testing and workspace environment across **backend** (Fastify + BullMQ) and **frontend** (Next.js 15 + React 19).
The goal is to make testing, debugging, and formatting seamless for every contributor while keeping personalized VS Code settings separate from team-wide configuration.

## 🧰 Workspace Architecture

### Root Workspace File — `myspinbot.code-workspace`

Includes entire repository (infra + backend + frontend):

```json
{
  "folders": [{ "path": "." }, { "path": "backend" }, { "path": "frontend" }],
  "settings": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "eslint.format.enable": true,
    "eslint.run": "onSave",
    "eslint.validate": ["javascript", "typescript", "json", "yaml"],
    "vitest.enableCoverage": true
  },
  "extensions": {
    "recommendations": [
      "vitest.explorer",
      "dbaeumer.vscode-eslint",
      "esbenp.prettier-vscode",
      "firsttris.vscode-jest-runner",
      "redhat.vscode-yaml"
    ]
  }
}
```

### Folder-Specific Configs

`backend/.vscode/settings.json`

```json
{
  "vitest.command": "npm test",
  "vitest.configFile": "vitest.config.ts",
  "vitest.enableCoverage": true
}
```

`frontend/.vscode/settings.json`

```json
{
  "vitest.command": "npm test",
  "vitest.configFile": "vitest.config.ts",
  "vitest.enableCoverage": true
}
```

Opening this workspace in VS Code yields three top-level folders: **myspinbot**, **backend**, **frontend**.
Each shows its own Vitest tests while sharing global formatting and linting.

## 🧭 Developer Guidelines

### ✅ Workspace-wide configuration

Commit and share these files:

- `myspinbot.code-workspace`
- `.vscode/settings.json`, `.vscode/extensions.json`, `.vscode/launch.json`
- `backend/.vscode/settings.json`, `frontend/.vscode/settings.json`

Purpose:

> Provide a consistent developer experience and reproducible test/lint environment.

### ⚠️ Personalized settings

Keep these **untracked** or add to `.gitignore`:

- `.vscode/workspaceStorage/`, `.vscode/history/`
- Editor theme, font, UI layout, and window state
- Any settings containing absolute paths or user-specific tokens

## 🧱 Testing Strategy Overview

| Scope            | Tech Stack                                               | Purpose                                                             |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| **Backend**      | Node 20 + Fastify + Vitest + Supertest                   | API integration and queue tests (e.g., `/api/train`, `/api/status`) |
| **Frontend**     | Next.js 15 + React 19 + Vitest + Testing Library + jsdom | Component and UI logic tests                                        |
| **E2E (future)** | Playwright                                               | Full browser-level flows (UI ↔ API ↔ Redis)                         |

All test layers share **Vitest** as the execution framework for consistent syntax and tooling integration.

## ⚙️ Environment Setup

### Backend Dev Dependencies

```bash
npm install -D vitest supertest eslint prettier \
  eslint-config-prettier eslint-plugin-import eslint-plugin-unused-imports \
  @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### Frontend Dev Dependencies

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom \
  eslint prettier eslint-config-prettier \
  eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-import eslint-plugin-unused-imports \
  @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

## 🧩 Vitest Configuration

### `/backend/vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.{js,ts}"],
    coverage: { reporter: ["text", "html"], provider: "v8" },
  },
});
```

### `/frontend/vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: { reporter: ["text", "html"], provider: "v8" },
  },
});
```

### Example Tests

**Backend — `tests/health.test.js`**

```js
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import healthRoute from "../src/routes/health.js";

describe("Health route", () => {
  let fastify;
  beforeAll(async () => {
    fastify = Fastify();
    await fastify.register(healthRoute);
    await fastify.ready();
  });
  afterAll(() => fastify.close());

  it("returns status ok", async () => {
    const res = await fastify.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: "ok" });
  });
});
```

**Frontend — `tests/UploadButton.test.tsx`**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { UploadButton } from "../components/UploadButton";

describe("UploadButton", () => {
  it("calls onClick when clicked", () => {
    const mockFn = vi.fn();
    render(<UploadButton onClick={mockFn} />);
    fireEvent.click(screen.getByText("Upload"));
    expect(mockFn).toHaveBeenCalledOnce();
  });
});
```

### 🧩 Quick Checklist

| Action                 | Scope                                                |
| ---------------------- | ---------------------------------------------------- |
| Run all backend tests  | `cd backend && npm test` or run via Vitest Explorer  |
| Run all frontend tests | `cd frontend && npm test` or run via Vitest Explorer |
| Auto-format            | Save file → Prettier formats automatically           |
| Lint                   | Runs on save; `npm run lint` for full check          |
| Debug test             | Click ▶️ icon beside any `it()` block                |

---

## 🧠 Summary

- **Vitest** powers testing across both environments with unified syntax.
- **VS Code workspace** integrates backend, frontend, and infra into one cohesive view.
- **Prettier + ESLint** enforce shared style while respecting personal overrides.
- The repo tracks only reproducible config — user state remains private.

> 🌀 _Result:_ consistent testing, clean commits, and a friction-free developer experience for every MySpinBot contributor.
