# 🧱 Runtime Data Directories

## 🎯 Purpose

These directories store **runtime-generated data** created by infrastructure services during operation.  
They are **excluded from Git** to avoid committing transient or sensitive data, but each includes a README file describing its purpose and contents.

## 📂 Directory Overview

| Path | Managed by | Contains | Persistence | Security |
|------|-------------|-----------|--------------|-----------|
| `traefik/data/letsencrypt/` | Traefik | ACME state (`acme.json`) | Persistent | Sensitive (private keys) |
| `traefik/logs/` | Traefik | Access and event logs | Ephemeral | Moderate |
| `prometheus/data/` | Prometheus | TSDB blocks and WAL data | Persistent | Low |
| `grafana/data/` | Grafana | SQLite DB, dashboards, plugins, sessions | Persistent | Moderate |

## ⚙️ Initialization

These directories are created automatically when you start the stack,  
but can also be created manually before first deployment:

```bash
mkdir -p traefik/data/letsencrypt
mkdir -p traefik/logs
mkdir -p prometheus/data
mkdir -p grafana/data
```

## 🧹 Maintenance

To **reset** runtime data for a clean redeploy:

```bash
# Stop services
docker compose stop

# Clear runtime directories (careful!)
rm -rf traefik/data/letsencrypt/*
rm -rf traefik/logs/*
rm -rf prometheus/data/*
rm -rf grafana/data/*

# Restart
docker compose up -d
```

> ⚠️ **Warning:** This will erase certificates, logs, dashboards, and all stored metrics.

## 🔒 Git Ignore Policy

All runtime directories are ignored in `.gitignore` to protect private and ephemeral data:

```
**/data/*
**/logs/*
!**/data/README*.md
!**/logs/README*.md
```

## 🧭 Summary

| Property | Value |
|-----------|--------|
| **Managed by** | Docker services (Traefik, Prometheus, Grafana) |
| **Contains** | Runtime and persisted service data |
| **Git status** | Ignored (only README tracked) |
| **Human action** | None, unless resetting or debugging |
| **Security** | Mixed — some contain private material |
