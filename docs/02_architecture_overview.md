# Architecture Overview

This document describes the system’s architecture at multiple levels: a high-level component map, detailed training and generation workflows, and user interaction flows. For each section, an informative diagram is provided.

## 1) High‑Level System Architecture

**Description:**
The platform is a local, multi-service stack organized around a Node.js backend (TypeScript) that orchestrates AI workflows, a Python GPU worker that executes heavy jobs, and specialized services for LLMs (Ollama + Open WebUI), diffusion pipelines (ComfyUI), storage (MinIO), state (Postgres/Redis), ingress (Traefik), and observability (Prometheus/Grafana with cAdvisor and NVIDIA DCGM exporter). All services live on a shared Docker network and expose metrics for unified monitoring.

**System Map**
```mermaid
flowchart LR
    %% Groups
    subgraph Ingress["Traefik Ingress"]
        T{{TLS & Routing}}
    end

    subgraph Frontend
        UI[Next.js Web App]
    end

    subgraph Backend["Node.js Backend"]
        API[Fastify API + WebSocket]
        LG[LangChain / LangGraph]
        Q[BullMQ]
    end

    subgraph Workers["GPU & AI Services"]
        PW[Python GPU Worker - Celery/RQ]
        CU[ComfyUI]
        OL[Ollama]
        OW[Open WebUI]
    end

    subgraph Data["State & Storage"]
        PG[(Postgres)]
        RD[(Redis)]
        S3[(MinIO / S3)]
    end

    subgraph Observability
        PR[Prometheus]
        GF[Grafana]
        CA[cAdvisor]
        NV[NVIDIA DCGM Exporter]
    end

    %% Connections
    T --> UI
    T --> API
    T --> OW
    T --> CU
    T --> GF
    T --> PR
    T --> S3

    UI <--> API
    API --> LG
    API <--> RD
    API <--> PG
    API <--> OL
    API <--> CU
    API --> Q
    Q --> RD

    PW <--> CU
    PW <--> S3
    PW <--> RD
    PW <--> PG

    OW <--> OL

    PR --> GF
    PR <--> CA
    PR <--> NV
    PR <--> API
    PR <--> PW
    PR <--> RD
    PR <--> CU
```

## 2) Training Workflow (LoRA + Voice)

**Description:**
The training workflow runs as queued GPU jobs. The user uploads images and a short audio sample. The Node API validates inputs, registers a profile, and enqueues two jobs: LoRA training (via kohya) and TTS voice setup (via F5‑TTS or GPT‑SoVITS). Artifacts are versioned and stored in MinIO; status and metrics are streamed back to the frontend.

**Training Pipeline**
```mermaid
sequenceDiagram
    autonumber
    participant U as User (Frontend)
    participant A as Node API
    participant R as Redis Queue
    participant W as Python Worker
    participant S as MinIO (S3)
    participant P as Postgres

    U->>A: Upload images + audio, create profile
    A->>P: Insert profile metadata
    A->>R: Enqueue train_lora(profile_id)
    A->>R: Enqueue train_voice(profile_id)
    R-->>W: Dequeue train_lora
    W->>W: Run kohya LoRA training
    W->>S: Save LoRA artifact (.safetensors)
    W->>P: Update artifact registry
    R-->>W: Dequeue train_voice
    W->>W: Run F5-TTS / GPT-SoVITS few-shot
    W->>S: Save voice checkpoint
    W->>P: Update artifact registry
    W-->>A: Progress events (Pub/Sub)
    A-->>U: Live status via WebSocket
```

## 3) Generation Workflow (Two alternatives)

The generation stage transforms a **prompt or narration** into a complete short video, synchronizing visuals and speech using local, open-source models. Two main workflows exist:

1. **SVD + Wav2Lip** — when we want to animate a static scene using Stable Video Diffusion and synchronize the lips later.  
2. **SadTalker Utilization** — when we generate a talking head directly from the image and TTS output, skipping explicit lip-syncing.

### SVD + Wav2Lip  
*(“Scene → Video → Speech → Lip Sync”)*

**Description:** The user provides a topic or narration prompt. The Node backend (via LangGraph) queries the local LLM (Ollama) to generate structured output with two components:

- **Stage description:** guides ComfyUI’s text-to-image node to render a static scene.  
- **Narrative:** supplies the spoken script for TTS synthesis.

ComfyUI first creates an image from the stage description, which the **Stable Video Diffusion (SVD)** node animates into a short clip. In parallel, the **Python GPU Worker** synthesizes audio using the profile’s **F5-TTS/GPT-SoVITS** voice.  Once both assets are ready, **Wav2Lip** aligns lip motion to speech, **ffmpeg** merges tracks, and **ESRGAN**  upscales the final video before remuxing and uploading to MinIO.

**Pipeline Diagram**
```mermaid
flowchart TD
    A[User Prompt or Caption] --> B[Node API]
    B --> C[LangGraph + Ollama LLM]
    C --> |Stage Description| D[ComfyUI TTI with LoRA]
    D --> E[SVD - Stable Video Diffusion]
    C --> |Narrative| F[TTS Synthesis F5-TTS/GPT-SoVITS]
    E --> H[Wav2Lip Lip-Sync]
    F --> H
    H --> I[ESRGAN Upscale]
    I --> J[Remux → Final MP4]
    J --> K[(MinIO Storage)]
    K --> L[Frontend Playback]
```

### Using SadTalker  
*(“Portrait → Talking Head → Speech Sync”)*

**Description:** This path uses **SadTalker** to drive a portrait directly with synthesized speech, bypassing SVD and Wav2Lip. The LLM output is used similarly, SadTalker then animates the portrait using facial-motion cues extracted from the audio. After generation, **ESRGAN** upscales the frames and **ffmpeg** finalizes the video for storage and playback.

**Pipeline Diagram**
```mermaid
flowchart TD
    A[User Prompt or Caption] --> B[Node API]
    B --> C[LangGraph + Ollama LLM]
    C --> |Stage Description| D[ComfyUI TTI with LoRA]
    C --> |Narrative| E[TTS Synthesis F5-TTS/GPT-SoVITS]
    D --> F[SadTalker Talking-Head Animation]
    E --> F
    F --> G[ESRGAN Upscale]
    G --> H[Remux → Final MP4]
    H --> I[MinIO Storage]
    I --> J[Frontend Playback]
```

**Summary:**  
Both alternatives share the same upstream logic (Node API → LLM → ComfyUI → TTS) and differ only in how visual motion and synchronization are achieved:

- **SVD + Wav2Lip:** general animated scenes or stylized avatars.  
- **SadTalker:** direct talking-head generation with natural facial motion.


## 4) User Interaction & States (Happy Path + Retries)

**Description:**
Users follow two primary flows, **Profile Training** and **Video Generation**. We represent UI states, backend events, and error‑retry loops (via LangGraph and queue semantics). The frontend uses WebSockets to reflect job progress in real time; failed stages can be retried idempotently.

**UI / State Flow**
```mermaid
stateDiagram-v2
    [*] --> Home

    %% Training branch
    Home --> TrainProfile : Upload images/audio
    TrainProfile --> Queued : Submit
    Queued --> Training : Worker picks up job
    Training --> Trained : Artifacts saved
    Training --> Failed : Error
    Failed --> Queued : Retry

    %% Generation branch
    Home --> Generate : Enter topic/caption
    Generate --> Generating : Start orchestration
    Generating --> Reviewing : MP4 ready
    Reviewing --> [*]
    Generating --> FailedGen : Error
    FailedGen --> Generating : Retry
```

---

## Notes on Extensibility
- **Model swaps**: The ComfyUI and TTS blocks are parameterized to allow switching base models (e.g., SD1.5 ↔ SDXL) and voice backends without touching the rest of the graph.
- **Scalability**: Replace the single Python worker with multiple replicas; preserve idempotency via job IDs and artifact paths. Make use of BullMQ priority and concurrency controls.
- **Security**: Place Traefik basic-auth or SSO in front of management UIs (Open WebUI, Grafana, Prometheus) and restrict them accordingly.
- **Observability**: Each service exposes `/metrics` for Prometheus; custom counters/gauges are added in the Python worker and Node backend for per-stage timing and failure analysis.

