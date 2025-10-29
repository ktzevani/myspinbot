# 📈 Grafana Guide — Dashboards & Visualization

## 🎯 Purpose

Grafana provides the **visual layer** for all MySpinBot metrics.  
It connects to Prometheus as the default datasource and renders real-time dashboards  
for containers, GPU utilization, and system performance.

## 🧱 Service Overview

| Component | Role |
|------------|------|
| **Grafana 11.2** | Visualization and dashboard service |
| **Prometheus datasource** | Metrics provider |
| **SQLite DB** | Stores users, dashboards, and settings |
| **Environment variables** | Secure admin configuration via `.env` |

## ⚙️ Configuration Files

| File | Path | Purpose |
|------|------|----------|
| `provisioning/datasources/prometheus.yml` | Defines Prometheus as the default datasource |
| `provisioning/dashboards/` | Pre-provisioned JSON dashboards |
| `data/` | Stores runtime DB and plugin cache (ignored in Git) |
| `.env` | Holds Grafana admin credentials and settings (ignored in Git) |
| `.env.example` | Public template for developers |

## 🧩 Environment Variables

Grafana credentials and settings are configured via `.env` (excluded from Git).  

Developers copy `.env.example` and fill in local values.

```bash
# ─────────────────────────────────────────────
# MySpinBot — Grafana Configuration
# Copy this file to ".env" and adjust values.
# ─────────────────────────────────────────────

GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=changeme

# Optional:
# GF_USERS_ALLOW_SIGN_UP=false
# GF_SECURITY_ALLOW_EMBEDDING=true
# GF_SERVER_DOMAIN=grafana.myspinbot.local
```

### Creating your local `.env`

```bash
cp .env.example .env
nano .env
```

## 🧰 Data Persistence

Grafana stores all runtime data under:

```
grafana/data/
```

This directory contains:
- `grafana.db` — the internal SQLite database  
- `plugins/` — installed plugin cache  
- `sessions/` — user session data  

> ⚠️ **Warning:** Removing this directory resets Grafana to a fresh install.

## 🧩 Prometheus Datasource Provisioning

Grafana is pre-configured to connect to Prometheus automatically via:

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

File location:

```
grafana/provisioning/datasources/prometheus.yml
```

## 📊 Default Dashboards

Dashboards are stored under:

```
grafana/provisioning/dashboards/
```

You can import additional dashboards manually through the Grafana UI:
**Settings → Dashboards → Import**

## ⚙️ Deployment

```bash
# 1️⃣ Prepare environment variables
cp .env.example .env

# 2️⃣ Start Grafana service
docker compose up -d grafana

# 3️⃣ Access the web UI
https://grafana.myspinbot.local
```

Login using the credentials defined in `.env`.

## 🧠 Troubleshooting

| Issue | Cause | Fix |
|--------|--------|-----|
| “Invalid username or password” | Wrong `.env` values | Recreate `.env` or restart Grafana |
| No dashboards visible | Missing provisioning folder | Ensure `grafana/provisioning/` is mounted correctly |
| Plugin install errors | Missing write permissions | Check `grafana/data/` ownership (`uid 472`) |

## 🧭 Summary

| Property | Value |
|-----------|--------|
| **Service** | Grafana 11.2 |
| **Purpose** | Visualization & dashboards |
| **Datasource** | Prometheus |
| **Managed by** | Docker Compose |
| **Config source** | `.env` file |
| **Data stored in** | `grafana/data/` |
| **Security** | Local credentials via `.env` |
| **Access URL** | `https://grafana.myspinbot.local` |
