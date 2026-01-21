# MySpinBot Project Description

## Purpose

This project aims to deliver a fully local, end‑to‑end platform that generates short, personalized videos of custom “bots” (human‑like or stylized avatars) from minimal user data: a small image set and a few seconds of audio. The initial set of non-functional requirements is that the system must be able to run on a single consumer GPU (e.g. RTX 5070 Ti) with modest available VRAM (i.e. minimum of 16GB) and rely strictly on open‑source components—models, code, and tooling—to ensure privacy, reproducibility, and longevity.

Beyond its functional prototype, **the project's primary objective is educational**. It serves as a comprehensive showcase of a modern, modular AI stack by demonstrating the clean integration of diverse technologies into one coherent system.

## What we will enable

- **One‑off profile training**: Users upload a number of images and ~10 s of audio samples to train a lightweight LoRA for identity/style and a few‑shot TTS voice profile. Artifacts are stored in an object storage and are reusable across sessions.
- **On‑demand video generation**: From a textual topic, a local LLM (via Ollama) produces a two‑part script—(A) scene “stage” description and (B) the narrative to speak. Custom diffusion pipelines convert the stage into an image, synthesize speech with the trained TTS, animate it into a short clip (I2V or talking‑head) with aligned lips and upscale/post-process frame to increase output quality. The result is an MP4 with synchronized audio.
- **Dual operation modes**: 
    - **Guided**—the LLM crafts stage + narrative automatically
    - **Direct**—advanced users provide their own caption/narration and optional scene prompt, bypassing the LLM for faster iteration.
- **Centralized management & visibility**:
    - **Models/artifacts management**: The platform will include Open WebUI to provide the users with Ollama LLM models management facilities (download, organize, experiment). An object storage frontend will also provide the ability to manage staged and produced artifacts.
    - **Prototyping**: ComfyUI server will be used for prototyping end-to-end pipelines before converting  them into actual Python code to be executed by the workers.
    - **Observability**: Prometheus and Grafana will enable comprehensive monitoring of GPU/queue/API metrics so users can observe performance, debug bottlenecks, and reason about trade‑offs (quality vs latency vs VRAM). 

## Why this matters

Generative media tools are increasingly cloud‑bound, license‑entangled, and opaque. This project demonstrates that **compelling, private, and controllable** AI video experiences are feasible on a single local GPU using **only open‑source** parts. By composing focused tools—ComfyUI for image/video, small open LLMs for planning, lightweight fine‑tuning for identity/voice, and classical lip‑sync—we create a pragmatic pipeline that balances _quality, speed, and compute cost_. Equally important, the architecture doubles as a **reference implementation** for engineers: it shows clean boundaries (API ↔ Redis bridge ↔ GPU workers), durable artifact management (MinIO/S3), and observability that makes GPU work measurable and repeatable. More details on system achitecture and design you will find [here](./02_architecture_overview.md).

## Success criteria (what “good” looks like)

- **Functional**: From upload to final MP4 (process) completes end‑to‑end on a 5070 Ti without OOMs, with selectable presets (speed/quality). Trained profiles are reusable; LLM‑guided prompts produce coherent stage + narrative.
- **Quality**: Lip‑sync is believable for portrait scenarios; video is artifact‑controlled at 576p–720p baseline with optional upscaling; voice timbre similarity is recognizably close for few‑shot inputs.
- **Operational**: Workflows execute safely and recover on failure. A dual‑plane LangGraph design runs control‑plane graphs in Node.js and data‑plane graphs in Python, with Redis Streams + Pub/Sub bridging job state between the two executors. Metrics are exposed to Prometheus, and all services are reproducible via Docker Compose with Traefik‑routed subdomains.
- **Open‑source compliance**: Core models and code are truly open (OSI‑compatible where applicable); documentation is complete and versioned; no proprietary APIs or hosted dependencies are required.

## Scope and constraints

- **In scope**: Wan-powered InfiniteTalk pipeline, LoRA training (SD 1.5 baseline; SDXL optional), F5‑TTS or GPT‑SoVITS, image→video via Stable Video Diffusion (and/or SadTalker for talking heads), ESRGAN upscaling, Wav2Lip for lip alignment, LangGraph orchestration (Node.js + Python), Dramatiq task execution, Open WebUI + Ollama for LLMs, Prometheus/Grafana for metrics, Postgres/Redis/MinIO for state and storage.
- **Constraints**: Runs on single GPU, modest VRAM budgeting, batch‑size/resolution caps, short clip lengths (seconds) stitched if necessary, **strictly open‑source** tooling and weights, and security defaults suitable for a private LAN (Traefik TLS, role‑based access in the app).
- **Non‑goals (initial)**: Long‑form video synthesis, real‑time streaming avatars, multi‑GPU scheduling, cloud autoscaling, or training large base models from scratch.

## Who this is for

- **Builders** who want a transparent, reproducible reference stack for local AI pipelines.
- **Researchers** evaluating practical trade‑offs between small LLM planning, diffusion video, and audio‑driven animation, or even specialized AI pipelines (e.g. operating on 3D/volumetric data) under strict compute budgets.
- **Teams** needing an on‑prem solution for private media generation where data and model artifacts must remain local.

## Outcome

The deliverable is a working, documented system and reference architecture that others can clone, run, and extend. It will include clear runbooks, observability dashboards, and composable workflows so users can swap models, adjust quality/latency settings, and add features (e.g., WebGPU previews, CUDA kernels, RAG) without destabilizing the core.
