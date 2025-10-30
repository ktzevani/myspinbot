# 🔐 MySpinBot Local Secrets

This directory stores **local secret files** used by Traefik for authentication
and other private credentials.  
It is **excluded from Git** for security reasons, as it contains sensitive data
that must only exist on your local machine or be injected by CI/CD.

## 📁 Expected Local Files

| File | Purpose |
|------|----------|
| `htpasswd` | BasicAuth credential file for the Traefik dashboard (`proxy.myspinbot.local`) |
| *(optional)* additional `.env` or key files | Other secrets required by local services or CI |

## 🧰 Provisioning Secrets

Secrets are created automatically using the helper script:

```bash
# Linux
./scripts/provision_secrets.sh
```

```powershell
# Windows
./scripts/provision_secrets.ps1
```

### By default, this will:

1. Create the directory structure if missing  
2. Generate a BasicAuth user `admin / admin`  
3. Produce a wildcard TLS certificate (`*.myspinbot.local`) via `mkcert`

## ⚙️ Environment Overrides

You can customize credentials and domain using environment variables:

| Variable | Description | Default |
|-----------|--------------|----------|
| `AUTH_USER` | BasicAuth username | `admin` |
| `AUTH_PASS` | BasicAuth password | `admin` |
| `DOMAIN` | Domain for wildcard certificate | `myspinbot.local` |
| `FORCE` | Overwrite existing secrets/certs | `false` |

### Example: custom credentials + domain

```bash
# Linux
AUTH_USER=myusername AUTH_PASS=UltraSecret DOMAIN=myspinbot.dev ./scripts/provision_secrets.sh
```

```powershell
# Windows
$env:AUTH_USER = "ktzev"
$env:AUTH_PASS = "UltraSecret"
$env:DOMAIN    = "myspinbot.dev"

.\scripts\provision_secrets.ps1
```

### Example: force regeneration

```bash
# Linux
FORCE=true ./scripts/provision_secrets.sh
```

```powershell
# Windows
$env:FORCE = "true" 
./scripts/provision_secrets.ps1
```

## 🔒 Manual Credential Creation (Linux - Alternative)

If you prefer to create them manually:

```bash
# Install Apache utilities (Linux)
sudo apt install apache2-utils

# Create a BasicAuth file for Traefik
htpasswd -cB traefik/secrets/htpasswd admin
```

## 🚫 Do Not Commit

All files in this directory are **sensitive** and must **never** be committed to Git.
They are ignored by default in `.gitignore`.

Only this README is tracked, to explain the folder’s purpose and preserve its structure.

## 🔁 Rotation

After regenerating credentials/certificates you need to restart Traefik:

```bash
docker compose restart traefik
```

## 🧭 Summary

| Property | Value |
|-----------|--------|
| **Managed by** | Developer / local provisioning script |
| **Contains** | BasicAuth credentials and related secret files |
| **Security** | Highly sensitive |
| **Git status** | Ignored |
| **Human action** | Generate locally via `scripts/provision_secrets.sh` |
