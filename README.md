# 🌀 MySpinBot

> _“Blurring the line of truth... Responsibly?...”_

Welcome to **MySpinBot**, the open-source, containerized platform for generating short personalized AI videos of talking “bots” — the kind that spin their way through voice cloning, LoRA training, and lip-syncing, all while making an effort not to melt your GPU.

Think of it as a creative factory where:

- You upload one or more images and a short audio voice clip along with some reference text,
- You prompt a local llm for creating a proper narrative and even a scene description,
- Then it creates the character and a setting[^1] for a portrait image, trains a voice clone and optionally a mini-LoRA[^1],
- And finally it stitches everything together by generating a staged, narrated, lip-synced video

All this **locally**, **privately**, and **under your control**.

[^1]: Still in TODOs. Current version supports uploading an existing portrait image instead of prompting for character creation or LoRA training.

<div align="center">
  <img height=700 src="/docs/resources/myspinbot_sample.gif" />
</div>

I took this on, after watching Computerphile’s [_MikeBot3000: Can We Build an AI Mike from Open Source Tools?_](https://www.youtube.com/watch?v=cP8xpkvs_UI) some months ago and used all the help I could get out of my trusty old pals **ChatGPT-5** and **Gemini 2.5** to make it spin — figuratively, literally, and sometimes uncontrollably.

My motivation was primarily **educational** but also I needed a facility in my home lab to act as an AI workbench. That is to enable me do things like: examine the inner workings of complex AI pipelines at the code level, testing new models that keeps popping up, especially in the **ComfyUI** ecosystem and in the domain of **Computer Vision**, and also play around with local agents. At the same time I also wanted the ability to quickly produce end-to-end prototypes (that is why I developed the Next.js/REACT frontend layer of the platform).

Hence, I developed a fully local platform which brings many open source components together into a unified AI infrastructure that one can freely use without the need to resolve to paid services. Extra details along with a more thoroughly-written (that is AI-generated[^2] 😎) project description can be found [here](docs/01_project_description.md).

[^2]: At this point, I'd like to stress that... I genuinely, with my own eyes and keyboard, reviewed and edited... most of the documentation/code that the AI produced.

## 🎥 So, not just another video generation pipeline

If you start digging into the project, you will find that this platform is not just a mere video generation automation, but a reference AI infrastructure deployment and a foundation that enables things like:
 - Defining/orchestrating local agents
 - Analysing and optimizing existing models and pipelines
 - Prototyping/researching models and workflows
 - and much more

For example one of my focus points for building this, was to put in place all required facilities so that I can develop and test **CUDA/PyCUDA** optimizations over existing **PyTorch** workflows in end-to-end use-cases.

## 🕸️ How much distributed can you get? 

*MySpinBot's* [Dual-plane orchestration layer](docs/phase2/dual_orchestration.md) makes it a platform which supports distributed processing, which in combination to the use of **LangGraph** and [Common Data Schemas](docs/phase2/shared_schemas.md) is able to manage, publish and execute heterogeneous workflows, i.e. workflows which contain tasks to be executed by **Node.js** and **Python** processes (targeting both CPU an GPU execution). At the same time it provides the means to (own-managed or external) llm agents, to plan and compile such workflows, by having its backend components advertise their capabilities via well defined services manifests[^3].

[^3]: Some more work to be done there, foundational components are all laid out though and are functional.

## 🥜 System Architecture In a nutshell

> _“Deep breath...”_

The [system architecture](docs/02_architecture_overview.md) features a **React UI** and a **Node.js orchestration layer**, which manages **LangGraph distributed workflows** across both **Node.js and Python runtimes**. The backend integrates **specialized AI facilities**, including **ComfyUI diffusion pipelines** and **Ollama-hosted local LLMs**. High-intensity machine learning tasks—such as LoRA training, Text-to-Speech (TTS), and lip-syncing—are handled by **Python-based workers managed via Dramatiq**[^4]. To ensure production-grade reliability, the entire ecosystem is supported by a full observability suite using **Prometheus and Grafana**. To ensure robustness the orchestration layer is build on-top of **Redis** and is backed by a **PostGreSQL persistence layer**. The latter can act also as a **vector database** for facilitating components like **RAG**[^5]. Furthermore, to manage input/output/staged data artifacts the system contains its own **MinIO object storage**, and finally, it all comes together via a **Traefix proxy** which manages routing and publishes underlying infrastructure's and custom backends services endpoints.

[^4]: Dramatiq to be introduced, right now Python tasks are managed by the running process and not by actors.
[^5]: Current implementation doesn't employ the use of Retrieval-Augmented Generation because the needs on llm context are minimal in the planned pipelines.

## 📚 Documentation

The full set of project documents lives in [`/docs`](./docs) — it explains everything from [_why this madness exists_](docs/01_project_description.md) to [_how it will be contained_](docs/04_modular_breakdown.md).

[`/docs`](./docs) directory also functions as a repository for providing context to coding agents. As better described [here](docs/phase2/development_workflow_revisited.md) the project is being developed with the use of **VS Code** and **Dev Containers Extension**. The latter provides proper sandboxing for one to deploy coding agents and let them go nuts if one likes. The idea is that initialy the agent will get in character by examining the root-level `GEMINI.md` which will trigger a context bootstrap process as the one described [here](./GEMINI.md#4-context-bootstrap-sequence), to make it go through the documentation in the proper order and fill its context window. Provisions are also been made for orchestrating different agents from their dev containers, centrally by a master-architect agent[^6]. At this point agents from different sandboxes share a common place which can use for communication amongst each other. 

For the human reader though, it is best to start from [documentation index](./docs/README.md) or [project description](docs/01_project_description.md).

[^6]: I didn't set it in motion yet though in my workstation, because I'm still lacking of a properly configured local own-managed MCP server.

## 🚀 Quick Start

There are basically **four** things you need to take care in order to set this beast up and running. First you need to **make sure your system covers the prerequisites**. Then, you **clone the repo** locally. After that, you need to **execute the provision script** according to your platform (Linux, Windows). Finally, you must **use compose to start the infrastructure**. Thats it!

1. **Prerequisites**

   - Docker with Compose
   - A beefy system with at least 64 GB RAM and lots of cores for the containers.
   - An Nvidia GPU with at least 16 GB of VRAM.
   - NVIDIA drivers + NVIDIA Container Toolkit
   - Local DNS or hostname setup so `*.myspinbot.local` resolves to your Docker host


   For reference the project has been developed and tested on a system with:

   - Windows 11
   - Docker Desktop >v4.55
   - 96 GB RAM
   - RTX 5070 Ti 16 GB VRAM
   - Core Ultra 9 285K (24 Cores)

   > 💡 If you are using Docker Desktop, make sure to have provide it enough of your system resources. My `.wslconfig` looks like this:
   > ```
   > [wsl2]
   > memory=80GB
   > processors=16
   > swap=16GB
   >  ```

2. **Clone this repository**

   ```
   git clone https://github.com/ktzevani/myspinbot.git
   ```

3. **Run provisioning script**

   `cd` into the newly downloaded workspace and based on you OS run one of the below replacing the passed parameters with the ones you desire. 

   **Linux:**

   ```bash
   AUTH_USER=myuser AUTH_PASS=SuperSecret DOMAIN=myspinbot.local DB_NAME=myspinbot ./scripts/provision_secrets.sh
   ```

   **Windows (Powershell):**

   ```powershell
   $env:AUTH_USER = "myuser"
   $env:AUTH_PASS = "SuperSecret"
   $env:DOMAIN    = "myspinbot.local"
   $env:DB_NAME    = "myspinbot"
   .\scripts\provision_secrets.ps1
   ```

   More information is found [here](docs/phase0/provision_scripts.md)

4. **Start MySpinBot infrastructure (Production)**

   ```bash
   docker compose -f docker-compose.yml up -d
   ```

🎉 Your local MySpinBot instance should start spinning!

### 💡 **There are a couple important things to be aware**

> ❗ Upon the first invocation of compose, docker images need to be pulled locally and also MySpinBot-specific custom images (backend, frontend, worker, sidecars etc.) need to be built locally. This will take some time, especially for the comfyui/worker custom image. So you need to be patient... 

> ❗ Upon the initialization of the infrastructure and after the docker images are pulled/built in local registry, the **downloader** sidecar will kick in and try to fetch more than **60GB** worth of data. That is all [required models](docs/03_tech_stack.md#-ai-models-used). So you need to be very patient...

> ❗ During the first invocation of the video generation pipeline, things might be a bit slower than usual due to the fact that additional downloads are going to occur.

> ❗ As all internal dashboards are accessed through local subdomains, you must configure your DNS resolution process (e.g. `/etc/hosts` on Linux/macOS, `C:\Windows\System32\drivers\etc\hosts` on Windows, or if you are running your custom DNS server you must configure it accordingly) so that these hostnames resolve to the proper IP of the docker host running the MySpinBot stack — typically `127.0.0.1` when running locally.
>
> Example of **hosts** file in Windows:
>
> ```
> 127.0.0.1 api.myspinbot.local
> 127.0.0.1 proxy.myspinbot.local
> 127.0.0.1 grafana.myspinbot.local
> 127.0.0.1 prometheus.myspinbot.local
> 127.0.0.1 ui.myspinbot.local
> 127.0.0.1 redis.myspinbot.local
> 127.0.0.1 s3.myspinbot.local
> 127.0.0.1 pgadmin.myspinbot.local
> 127.0.0.1 openwebui.myspinbot.local
> 127.0.0.1 comfyui.myspinbot.local
> ```
>
> Without proper hostname resolution, Traefik routing and TLS certificate validation will fail.

## Browsing around

When the production infrastructure goes up you will have access to all included facilities. If you kept `DOMAIN` parameter at the provisioning stage equal to `myspinbot.local` the following links should work out of the box (you need to use the configured credentials):

   - Frontend: https://ui.myspinbot.local
   - API: https://api.myspinbot.local
      - Health endpoint: https://api.myspinbot.local/health
      - Get-Capabilities endpoint: https://api.myspinbot.local/api/capabilities
   - Traefix Dashboard: https://proxy.myspinbot.local/
   - Grafana: https://grafana.myspinbot.local
   - Prometheus: https://prometheus.myspinbot.local
   - Redis Insight: https://redis.myspinbot.local
   - MinIO Panel/Console: https://s3.myspinbot.local
   - pgAdmin Panel (PostgreSQL): https://pgadmin.myspinbot.local
   - ComfyUI Workspace: https://comfyui.myspinbot.local
   - OpenWebUI Portal[^7]: https://openwebui.myspinbot.local

[^7]: Only active if you start up `chatbot` [profile](./docs/04_modular_breakdown.md#chatbot-profile)

<div align="center">
  <img src="/docs/resources/infra_sample.gif" />
</div>

## 🧱 Current Status

| Phase      | Title                                  | Status       |
| :--------- | :------------------------------------- | :----------- |
| 🧊 Subzero | Repo setup + docs freeze               | ✅ Completed |
| 0          | Infra Bootstrap (Traefik + Monitoring) | ✅ Completed |
| 1          | Backend & Frontend Scaffold            | ✅ Completed |
| 2          | Worker Integration & Dual-plane Orchestration | ✅ Completed  |
| 3          | AI Pipeline Implementation             | ✅ Completed   |
| 4          | Quality & Observability                | 🕓 Pending   |
| 5          | Polish & Docs                          | ⏳ Planned   |

> See [`history.md`](./docs/06_history.md) for how the architecture evolved across development phases.

## 🧠 Guiding Principles

- **Local-First.** No data leaves your machine.
- **Metrics-First.** Every container speaks Prometheus.
- **Open-Source.** Every dependency is transparent and replaceable.
- **GPU-Aware.** Jobs are serialized to protect your VRAM’s dignity.
- **Humor-Tolerant.** Because debugging diffusion pipelines without sarcasm is impossible.

## 💬 Contributing

Contributions, ideas, and sarcastic bug reports are welcome.  
Open an issue, start a discussion, or send a pull request.  
Be kind — we’re all just trying to make our bots talk before the GPU fans hit Mach 3.

## ⚖️ License

This project is licensed under the **AGPL-3.0** License — see the [LICENSE](./LICENSE) file for details.

## 🚀 Closing Remark

Phase 4 is on its way, brace yourself: the spin just went **interactive**.
May your API routes be fast, your Redis never block, and your GPU stay smugly at 42 °C.
