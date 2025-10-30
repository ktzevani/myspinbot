# 🧭 Phase 0 — Infrastructure Bootstrap

## 🎯 Objective
Phase 0 establishes the **infrastructure foundation** of the MySpinBot platform.  
It provides secure HTTPS routing, observability, and runtime metrics through a stack of open-source services:

- **Traefik 2.11** — Reverse proxy and TLS termination  
- **Prometheus 3.0** — Metrics collection and scraping  
- **Grafana 11.2** — Dashboards and visualization  
- **cAdvisor + DCGM Exporter** — Container and GPU telemetry  

This phase ensures that all subsequent phases (backend, worker, AI pipeline) run on a stable, monitored, TLS-secured platform.

## 🧱 Stack Overview

| Service | Purpose | Access |
|----------|----------|--------|
| Traefik | Reverse proxy + TLS termination | `https://proxy.myspinbot.local` |
| Prometheus | Metrics scraping for containers and GPU | `https://prometheus.myspinbot.local` |
| Grafana | Dashboards + visual analytics | `https://grafana.myspinbot.local` |
| cAdvisor | Container metrics exporter | `:8080` (internal) |
| DCGM Exporter | GPU metrics exporter | `:9400` (internal) |

## ⚙️ Deployment Steps

```bash
# 1️⃣ Generate local secrets and certificates
./scripts/provision_secrets.sh

# 2️⃣ Create and configure environment variables
cp .env.example .env
nano .env

# 3️⃣ Start the stack
docker compose up -d
```

When startup completes, open:

- 🔹 **Grafana:** `https://grafana.myspinbot.local`  
- 🔹 **Prometheus:** `https://prometheus.myspinbot.local`  
- 🔹 **Traefik Dashboard:** `https://proxy.myspinbot.local`

Login to Grafana using the credentials from `.env`. Login to the rest of the facilities with the credentials in `htpasswd`.

> 💡 **DNS / Hostname Configuration**
>
> As all internal dashboards are accessed through local subdomains, you must configure your 
> DNS resolution process (e.g. `/etc/hosts` on Linux/macOS, `C:\Windows\System32\drivers\etc\hosts` 
> on Windows, or a custom DNS server such as dnsmasq/AdGuard/HomeAssistant)
> so that these hostnames resolve to the proper IP of the node
> running the MySpinBot stack — typically `127.0.0.1` when running locally.
>
> Example:
> ```
> 127.0.0.1 proxy.myspinbot.local
> 127.0.0.1 prometheus.myspinbot.local
> 127.0.0.1 grafana.myspinbot.local
> ```
> Without proper hostname resolution, Traefik routing and TLS certificate validation
> (e.g. via mkcert wildcard `*.myspinbot.local`) will fail.


## ✅ Validation Checklist

| Check | Command / Method | Expected |
|-------|------------------|-----------|
| Containers healthy | `docker ps` | All show `Up (healthy)` |
| GPU metrics visible | Prometheus → `DCGM_FI_DEV_GPU_UTIL` | Values updating |
| Grafana reachable | Browser to `https://grafana.myspinbot.local` | Login prompt and default dashboard |
| TLS valid (local CA) | Browser padlock | Certificate trusted by mkcert CA |

## ⚡ Common Issues & Fixes

| Symptom | Cause | Fix |
|----------|--------|-----|
| **`Bad Gateway` from Traefik** | Container not yet healthy | Wait for compose healthchecks or run `docker compose ps` |
| **Grafana login fails** | Wrong .env values | Re-check `GF_SECURITY_ADMIN_*` in `.env` |
| **Cert invalid in browser** | mkcert CA not installed | Run `mkcert -install` on host machine |

## 🧩 Next Steps

Once Phase 0 is running and validated:

1. Proceed to Phase 1 — Backend & Frontend Scaffold  
2. Keep Prometheus and Grafana active during all subsequent phases for monitoring  
3. Reference the service-specific guides below for details  

- [Traefik Guide](traefik_guide.md)  
- [Prometheus Guide](prometheus_guide.md)  
- [Grafana Guide](grafana_guide.md)  
- [Runtime Directories](runtime_dirs.md)

## 🧭 Summary

| Property | Value |
|-----------|--------|
| **Phase** | 0 — Infrastructure Bootstrap |
| **Purpose** | Establish routing, TLS, and metrics foundation |
| **Managed by** | Docker Compose + Traefik + Prometheus + Grafana |
| **Security** | Local CA TLS + BasicAuth |
| **Output** | Operational observability stack |
| **Next** | Phase 1 — Backend & Frontend Scaffold |
