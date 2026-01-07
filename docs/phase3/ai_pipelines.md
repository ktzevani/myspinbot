# 🧬 Phase 3 — AI Pipelines & LangGraph Workflows

## 🧭 Purpose

This document defines the **AI video generation pipelines** planned for Phase 3:

- The concrete **workflow variants** (SVD + Wav2Lip, SadTalker).
- Their representation as **hybrid LangGraph graphs** spanning Node.js and Python planes.
- The **task contracts** (inputs/outputs, side effects) for each node.
- The **API‑level entrypoints** and expected request/response shapes.

It is a design target for implementation and testing, not a snapshot of the current code.

---

## 1️⃣ Pipeline Variants

MySpinBot supports two main video generation variants in Phase 3.

### 1.1 SVD + Wav2Lip Variant

> “Scene → Video → Speech → Lip‑Sync”

- **Use‑case:** generic animated scenes and avatars.
- **High‑level flow:**
  1. LLM generates stage description + narrative script.
  2. ComfyUI + Stable Diffusion create scene imagery (optionally with LoRA).
  3. Stable Video Diffusion (SVD) turns images into a short clip.
  4. TTS stack synthesizes speech from the narrative.
  5. Wav2Lip aligns lip motion in the video to the speech.
  6. ESRGAN / ffmpeg perform optional upscaling and muxing.

### 1.2 SadTalker Variant

> “Portrait → Talking Head → Speech Sync”

- **Use‑case:** talking‑head style outputs from portrait images.
- **High‑level flow:**
  1. LLM generates narrative script (stage optional).
  2. TTS stack synthesizes speech.
  3. SadTalker animates a portrait directly from speech (and optional head pose).
  4. ESRGAN / ffmpeg perform optional upscaling and muxing.

Both variants share **control‑plane steps** (planning, scripting, job metadata) and diverge in **data‑plane rendering**.

---

## 2️⃣ LangGraph Workflow Shapes

We express each pipeline as a **LangGraph graph** with nodes assigned to planes:

- `plane: "node"` → Control Plane (Node.js, backend).
- `plane: "python"` → Data Plane (Python worker).

### 2.1 Training‑First Workflow (Profile + Video)

Use when the user uploads images/audio and wants both training and video generation in one shot.

**Conceptual nodes:**

- Control Plane (`plane: "node"`):
  - `script.generateScript`
  - `profiles.resolveOrCreate` (decide whether to create a new profile)
  - `planner.selectPipeline` (choose variant & options)
- Data Plane (`plane: "python"`):
  - `train_lora`
  - `train_voice`
  - `render_video` (variant‑aware)
  - `artifacts.registerOutputs`

**Graph outline (simplified):**

```json
{
  "workflow_id": "train_and_generate_v1",
  "nodes": [
    { "id": "script", "task": "script.generateScript", "plane": "node" },
    { "id": "profile", "task": "profiles.resolveOrCreate", "plane": "node" },
    { "id": "train_lora", "task": "train_lora", "plane": "python" },
    { "id": "train_voice", "task": "train_voice", "plane": "python" },
    { "id": "render", "task": "render_video", "plane": "python" },
    { "id": "register", "task": "artifacts.registerOutputs", "plane": "node" }
  ],
  "edges": [
    { "from": "script", "to": "profile" },
    { "from": "profile", "to": "train_lora" },
    { "from": "profile", "to": "train_voice" },
    { "from": "train_lora", "to": "render" },
    { "from": "train_voice", "to": "render" },
    { "from": "render", "to": "register" }
  ]
}
```

### 2.2 Generation‑Only Workflow (Existing Profile)

Use when the user selects an existing profile and only wants a new video.

**Nodes:**

- Control Plane:
  - `script.generateScript`
  - `profiles.loadExisting`
  - `planner.selectPipeline`
- Data Plane:
  - `render_video`
  - `artifacts.registerOutputs`

**Graph outline (simplified):**

```json
{
  "workflow_id": "generate_v1",
  "nodes": [
    { "id": "script", "task": "script.generateScript", "plane": "node" },
    { "id": "render", "task": "render_video", "plane": "python" },
    { "id": "register", "task": "artifacts.registerOutputs", "plane": "node" }
  ]
}
```

In both workflows, the **Agentic Planner** is responsible for emitting a valid graph whose nodes:

- Use only registered tasks (control or worker plane).
- Respect capability flags (e.g. TTS enabled, SadTalker available).
- Encode variant choice (SVD + Wav2Lip vs SadTalker) via node parameters.

---

## 3️⃣ Node & Task Contracts

This section defines the **expected contracts** for key tasks. Actual schemas live under `common/config/schemas/**`.

### 3.1 Control‑Plane Tasks (`plane: "node"`)

| Task                        | Inputs (context)                                                                 | Outputs (context additions)                                                  | Notes                                      |
| --------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| `script.generateScript`     | `topic`, `tone`, capabilities manifest                    | `script`: `{ stage: string, narrative: string }`                             | Runs Ollama; must return structured JSON.  |
| `profiles.resolveOrCreate`  | `userId`, upload metadata, partial profile params                               | `profile`: `{ id, loraId?, voiceId? }`                                       | Creates or reuses profile; writes to DB.   |
| `planner.selectPipeline`    | `requestedVariant`, capabilities, `profile`                                     | `pipeline`: `{ variant: "svd" \| "sadtalker", params: { … } }`               | Chooses variant and config.                |
| `artifacts.registerOutputs` | `jobId`, `pipeline`, produced artifact URIs from data plane (`video`, `assets`) | `artifacts`: list of IDs and URIs; updates Postgres `artifacts` / `jobs` row | Centralizes artifact + job persistence.    |

### 3.2 Data‑Plane Tasks (`plane: "python"`)

| Task           | Inputs (context)                                                                                      | Outputs (context additions)                                             | Side Effects                                             |
| -------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| `train_lora`   | `profile.id`, paths to training images in MinIO, model/config presets                                 | `profile.loraId` (or equivalent reference)                              | Uploads LoRA weights to MinIO; updates profile record.   |
| `train_voice`  | `profile.id`, paths to voice audio clips in MinIO, config presets                                     | `profile.voiceId` or voice profile reference                            | Uploads TTS model artifacts to MinIO.                    |
| `render_video` | `pipeline.variant`, `script`, `profile` (with `loraId`/`voiceId`), rendering params (duration, fps…) | `video`: `{ uri, thumbnailUri?, duration, variant }`                    | Invokes ComfyUI + TTS + Wav2Lip/SadTalker + ffmpeg stack |
| `tts.synthesize` (internal helper) | `script.narrative`, `profile.voiceId`, audio params                               | `audio`: `{ uri, duration, sampleRate }`                                | Writes audio file to MinIO.                             |
| `lipsync.apply` (internal helper)  | `video` or `frames`, `audio`, variant‑specific params                             | updated `video` `{ uri, duration }`                                     | Applies Wav2Lip or SadTalker.                           |

Phase 3 does **not** require every helper to be exposed as a standalone graph node. The initial implementation may:

- Keep `render_video` as a **compound task** that internally calls ComfyUI, TTS and lip‑sync.
- Expose only top‑level node outputs (`video`, `artifacts`) to the graph.

### 3.3 Dramatiq as the Worker Execution Layer

On the Python side, long‑running GPU‑style work is handled by **Dramatiq**:

- Each data‑plane task (`train_lora`, `train_voice`, `render_video`, etc.) is implemented as a **Dramatiq actor**.
- The LangGraph worker executor does not perform heavy work inline; instead, it:
  - Enqueues or triggers the appropriate Dramatiq actor.
  - Bridges actor progress back into Redis Pub/Sub and job state updates.
  - Marks the corresponding graph node as `running` / `completed` / `failed` based on actor outcome.
- Dramatiq’s broker configuration (Redis URL, queues, concurrency) is captured in the worker configuration schema and surfaced via metrics where useful.

From the graph’s point of view, this remains an implementation detail: a `plane: "python"` node is still just a single logical step even though it may be backed by one or more Dramatiq actors internally.

Later phases can split `render_video` into multiple nodes if finer‑grained observability or retries are desired.

---

## 4️⃣ Planner Inputs & LLM Prompts

### 4.1 Planner Input Shape

The Agentic Planner receives a structured prompt, capabilities, and user context:

```json
{
  "goal": "Generate a 20-second humorous explainer about black holes.",
  "user_context": {
    "user_id": "u123",
    "profile_id": "p001",
    "style": "playful"
  },
  "requested_variant": "svd",
  "capabilities_manifest": {
    "python": { "train_lora": { "enabled": true }, "render_video": { "variants": ["svd", "sadtalker"] } },
    "node": { "script.generateScript": { "enabled": true } }
  },
  "constraints": {
    "max_duration_seconds": 20,
    "max_resolution": "720p"
  }
}
```

The planner must map this to a **valid graph** using only advertised tasks.

### 4.2 Script Generation Prompt (LLM)

The `script.generateScript` node uses a prompt template along the lines of:

- **System instructions:** explain the required JSON structure and constraints.
- **User content:** the `goal`, `style`, and optional `profile` metadata.

Expected LLM output (before validation):

```json
{
  "stage": "A stylized observatory under a starry sky with a cartoon black hole in the distance.",
  "narrative": "Black holes are regions of space where gravity is so strong..."
}
```

The backend validates this against the shared **script schema** before injecting it into graph context.

---

## 5️⃣ API‑Level Entry Points

Phase 3 introduces or formalizes API endpoints around the pipelines.

### 5.1 Training + Generation

- `POST /api/train`
  - **Purpose:** upload inputs and trigger the `train_and_generate_v1` workflow.
  - **Body (conceptual):**

    ```json
    {
      "mode": "train_and_generate",
      "topic": "Explain gradient descent like I'm five.",
      "variant": "svd",
      "images": ["s3://uploads/u123/img1.png", "s3://uploads/u123/img2.png"],
      "audio": ["s3://uploads/u123/voice1.wav"]
    }
    ```

  - **Response:**

    ```json
    { "jobId": "job-abc123", "status": "queued" }
    ```

  - Execution:
    - Backend planner builds the full graph and enqueues it to the control stream.
    - Job state flows as in Phase 2 (WebSocket + Redis), now with richer pipeline context.

### 5.2 Generation (no LoRA training)

- `POST /api/generate`
  - **Purpose:** run `generate_v1` without weight adaptation.
  - **Body (conceptual):**

    ```json
    {
      "mode": "generate",
      "topic": "Daily market summary",
      "variant": "sadtalker",
      "options": { "durationSeconds": 30, "resolution": "576p" }
    }
    ```

  - **Response:** same pattern as `/api/train`.

### 5.3 Job & Artifact Introspection

Phase 3 also relies on:

- `GET /api/status/:jobId` → live job state (as in Phase 2).
- `GET /api/jobs/:jobId` → enriched job record, including:
  - Chosen pipeline variant.
  - Script summary (possibly redacted).
  - Artifact list (video URI, thumbnails, debug logs).

---

## 6️⃣ Failure Modes & Retries

While full resilience is a Phase 4 concern, Phase 3 plans for basic failure behaviors:

- **LLM failure:** `script.generateScript` fails → mark job `failed` with an explanatory reason; no GPU work started.
- **ComfyUI / TTS / Lip‑sync failures:** `render_video` fails → job fails, with logs/artifact references where possible.
- **Partial outputs:** when safe, intermediate artifacts (e.g. base video without lip‑sync) are still registered for debugging.
- **Retries:** manual retries are supported by re‑submitting a new job reusing the same profile and topic; automatic retries remain out‑of‑scope for this phase.

---

## 7️⃣ Implementation Phasing Inside Phase 3

To reduce risk, Phase 3 pipeline work is staged internally:

1. **Skeleton pipeline graphs**
   - Implement planner graph emission with simulated `render_video`.
   - Verify end‑to‑end graph handoff, status, and persistence.
2. **LLM + Script Integration**
   - Add `ollama` and `open-webui` services to the Compose stack (if not already present), with appropriate Traefik routing and GPU access.
   - Wire `script.generateScript` to a real Ollama model via the internal HTTP endpoint.
   - Validate prompt/response behavior and schema enforcement.
3. **Render Pipeline (Minimal)**
   - Add `comfyui` to the infra stack (if not already present) and route it via Traefik where appropriate.
   - Implement `render_video` as a “hybrid” task:
     - Call ComfyUI with a simple workflow.
     - Use TTS / lip‑sync runtimes embedded in the worker image (via internal Python APIs or subprocesses), or stub them if real services are not yet ready.
4. **Full AI Pipeline**
   - Add real TTS and Wav2Lip/SadTalker integration.
   - Expose basic pipeline metrics (per‑stage durations, failure counts).
5. **Profile & Artifact Enrichment**
   - Wire Postgres artifact records to the pipeline.
   - Validate profile reuse flows for `/api/generate`.

Each sub‑stage is independently shippable and observable, allowing incremental progress toward the full vision without destabilizing existing Phase 2 behavior.

---

## 8️⃣ Frontend Integration Overview

While most of the AI pipeline complexity lives in the backend and worker, Phase 3 also requires **UI‑level support**:

- **New submission controls**
  - Extend the main upload form to:
    - Choose between “Train & Generate” and “Generate from Existing Profile”.
    - Select a pipeline variant (`"svd"` vs `"sadtalker"`) and simple options like duration preset.
    - Optionally select an existing profile (by ID or from a small list) for generate‑only jobs.
- **Richer job cards**
  - Augment `StatusCard` (or equivalent components) to show:
    - Mode and variant (e.g., `Train+Generate · SVD`).
    - Profile label or ID.
    - Links to final video artifacts once `video.uri` is available.
  - Continue to rely on the existing WebSocket stream; no new WS protocol is required, only additional fields in job state.
- **Minimal history view**
  - Optionally add a simple job history section using the new `/api/jobs` endpoints, so users can re‑open recent pipeline runs and replay or inspect outputs.

These changes are intentionally small and incremental, but they ensure the UI can express the more complex Phase 3 scenarios without redesigning the entire frontend.
