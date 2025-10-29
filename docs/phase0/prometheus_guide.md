# 📊 Prometheus Guide — Metrics & Monitoring

## 🎯 Purpose

Prometheus provides **time-series data collection** and **metrics monitoring** for the MySpinBot infrastructure.  
It continuously scrapes cAdvisor, DCGM Exporter, Traefik, and system targets —  
storing metrics locally in a TSDB (time-series database) under `prometheus/data/`.

## 🧱 Service Overview

| Component | Role |
|------------|------|
| **Prometheus 3.0** | Metrics collection and querying |
| **cAdvisor** | Container-level CPU, memory, and I/O metrics |
| **DCGM Exporter** | GPU telemetry (utilization, temperature, memory) |
| **Traefik metrics endpoint** | HTTP and router metrics |
| **Grafana datasource** | Connects Prometheus to Grafana dashboards |

## ⚙️ Configuration Files

| File | Path | Purpose |
|------|------|----------|
| `prometheus.yml` | `./prometheus/prometheus.yml` | Main configuration file — scrape targets, intervals |
| `alert.rules.yml` | *(optional)* | Custom alert rules (future phases) |
| `data/` | `./prometheus/data/` | Persistent TSDB storage (runtime) |

## 📘 Example Prometheus Configuration

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  - job_name: "traefik"
    static_configs:
      - targets: ["traefik:8082"]

  - job_name: "cadvisor"
    static_configs:
      - targets: ["cadvisor:8080"]

  - job_name: "dcgm_exporter"
    static_configs:
      - targets: ["dcgm-exporter:9400"]
```

## 🧱 Data Persistence

Prometheus stores its database in `./prometheus/data/`.  
This directory is mounted as a persistent Docker volume to survive container restarts.

> ⚠️ **Warning:** deleting this directory erases all stored time-series data.

If you need to reset metrics:

```bash
docker compose stop prometheus
rm -rf prometheus/data/*
docker compose start prometheus
```

## 🧰 Grafana Integration

Grafana is pre-provisioned with Prometheus as the default datasource via:

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

Datasource file location:

```
grafana/provisioning/datasources/prometheus.yml
```

## 🔍 Querying Metrics

Access Prometheus directly at  
**URL:** `https://prometheus.myspinbot.local`

Example queries:
- `up` → Show all active targets
- `container_cpu_usage_seconds_total` → CPU usage by container
- `DCGM_FI_DEV_GPU_UTIL` → GPU utilization from DCGM Exporter

## 🧠 Troubleshooting

| Issue | Cause | Fix |
|--------|--------|-----|
| “No data” in Grafana | Prometheus not scraping targets | Check targets via Prometheus UI → *Status → Targets* |
| Disk usage high | Large TSDB retention | Add `--storage.tsdb.retention.time=7d` flag or clear data directory |
| Scrape errors | Wrong service names in config | Verify Docker network hostnames match service names |

## 🧭 Summary

| Property | Value |
|-----------|--------|
| **Service** | Prometheus 3.0 |
| **Purpose** | Metrics collection and time-series database |
| **Managed by** | Docker Compose |
| **Data stored in** | `prometheus/data/` |
| **Security** | Internal-only (scraped via private Docker network) |
| **Access URL** | `https://prometheus.myspinbot.local` |
| **Integration** | Default Grafana datasource |
