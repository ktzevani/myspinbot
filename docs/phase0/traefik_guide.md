# 🚦 Traefik Guide — Reverse Proxy & TLS

## 🎯 Purpose

Traefik acts as the **entry point** for all HTTP(S) traffic in MySpinBot.  
It performs secure TLS termination, routes requests to internal services, and provides a web dashboard for monitoring router states and certificate status.

## 🧱 Service Overview

| Component | Role |
|------------|------|
| **Traefik 2.11** | Reverse proxy and router |
| **ACME (Let’s Encrypt)** | Automatic TLS certificate management |
| **mkcert** | Local CA for development certificates |
| **BasicAuth** | Secures the Traefik dashboard |

## ⚙️ Configuration Files

| File | Location | Purpose |
|------|-----------|----------|
| `traefik.yml` | `./traefik/traefik.yml` | Static configuration (entrypoints, providers) |
| `traefik_dynamic.yml` | `./traefik/traefik_dynamic.yml` | Dynamic configuration (TLS store, transports) |
| `acme.json` | `./traefik/data/letsencrypt/acme.json` | ACME certificate cache (runtime) |

## 🧰 Secret & Certificate Provisioning

All secrets and certificates are handled via the platform-specific provisioning scripts:

### 🐧 Linux / macOS

```bash
./scripts/provision_secrets.sh
```

By default, this script will:  
1. Create the secrets and cert directories if missing  
2. Generate a BasicAuth file (`htpasswd`) with default credentials  
3. Issue a wildcard TLS certificate for `*.myspinbot.local` using **mkcert**

To customize credentials or domain:

```bash
AUTH_USER=ktzev AUTH_PASS=UltraSecret DOMAIN=myspinbot.dev ./scripts/provision_secrets.sh
```

To regenerate existing secrets:

```bash
FORCE=true ./scripts/provision_secrets.sh
```

### 💠 Windows (PowerShell)

```powershell
.\scripts\provision_secrets.ps1
```

By default, this script will:  
1. Create the secrets and cert directories if missing  
2. Generate a BasicAuth file (`htpasswd`) with default credentials (via **OpenSSL**)  
3. Issue a wildcard TLS certificate for `*.myspinbot.local` using **mkcert**

To customize credentials or domain:

```powershell
$env:AUTH_USER = "ktzev"
$env:AUTH_PASS = "UltraSecret"
$env:DOMAIN    = "myspinbot.dev"

.\scripts\provision_secrets.ps1
```

To regenerate existing secrets:

```powershell
$env:FORCE = "true"
.\scripts\provision_secrets.ps1
```

---

### ⚙️ Notes

- Both scripts produce the same output layout under `traefik/secrets/` and `traefik/certs/`.  
- Hash algorithm differs by platform:
  - **Linux/macOS:** `bcrypt` (default for Apache `htpasswd -B`)
  - **Windows:** `apr1` (Apache MD5, compatible with Traefik)
- On **Windows**, ensure that **mkcert** and **OpenSSL** are installed and available in your PATH.  
  You can conveniently install them using **WinGet**:

  ```
  winget install FiloSottile.mkcert
  winget install ShiningLight.OpenSSL
  ```

- These artifacts are sensitive and are **excluded from Git** by default (`.gitignore`).

## 📁 Directory Structure

| Directory | Description |
|------------|--------------|
| `traefik/` | Base configuration directory |
| `traefik/certs/` | Local TLS certificates (ignored in Git) |
| `traefik/secrets/` | BasicAuth and related secret files (ignored in Git) |
| `traefik/logs/` | Runtime log output (ignored in Git) |
| `traefik/data/letsencrypt/` | ACME storage (runtime) |

Each of these directories includes its own README file explaining content and Git policy.

## 🔒 Dashboard Access

- URL: `https://proxy.myspinbot.local`  
- Auth: BasicAuth credentials from `traefik/secrets/htpasswd`

To change credentials manually:

```
htpasswd -cB traefik/secrets/htpasswd newuser
```

Restart Traefik to apply.

## 🧩 TLS Certificates

Local TLS certificates are stored in `traefik/certs/` as:

- `wildcard-myspinbot.local.crt`  
- `wildcard-myspinbot.local.key`

You can replace them with CA-issued certificates at any time:

```bash
cp /path/to/fullchain.pem traefik/certs/wildcard-myspinbot.local.crt
cp /path/to/privkey.pem traefik/certs/wildcard-myspinbot.local.key
docker compose restart traefik
```

## ⚙️ Traefik Docker Labels (example)

These labels define the routers for the Traefik dashboard, Prometheus, and Grafana:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.dashboard.rule=Host(`proxy.myspinbot.local`)"
  - "traefik.http.routers.dashboard.entrypoints=websecure"
  - "traefik.http.routers.dashboard.service=api@internal"
  - "traefik.http.routers.dashboard.tls=true"
```

Additional services (Prometheus, Grafana) are routed via similar label sets.

## 🧠 Troubleshooting

| Issue | Cause | Solution |
|-------|--------|-----------|
| Browser shows “Not Secure” | mkcert CA not installed | Run `mkcert -install` |
| “Bad Gateway” for backend | Service not ready or unhealthy | Check with `docker compose ps` |
| Dashboard login fails | Invalid htpasswd credentials | Regenerate via provisioning script |

## 🧭 Summary

| Property | Value |
|-----------|--------|
| **Service** | Traefik 2.11 |
| **Purpose** | Reverse proxy, TLS termination, routing |
| **Security** | mkcert certificates + BasicAuth |
| **Managed by** | Docker Compose + provisioning script |
| **Runtime data** | ACME storage, logs |
| **Access** | `https://proxy.myspinbot.local` |
