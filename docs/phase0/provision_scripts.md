# 🧰 Provisioning Infrastructure Configuration and Secrets

## 🎯 Purpose

This document contains instructions for using the provisioning scripts.

## Instructions

Secrets are created automatically using the provisioning scripts:

```bash
# Linux
./scripts/provision_secrets.sh
```

```powershell
# Windows
./scripts/provision_secrets.ps1
```

### By default, this will:

1. Create the required directory structure if missing
2. Generate a BasicAuth user `AUTH_USER / AUTH_PASS`  
3. Produce a wildcard TLS certificate (`*.DOMAIN`) via `mkcert`
4. Generate `root.env` files in each affected infra component containing credentials in-sync to the Traefik BasicAuth ones
5. Set secure file permissions (`chmod 600`)

> NOTE: This files are maintained **outside of version control**.

## ⚙️ Environment Overrides

You can customize credentials and domain using environment variables before running the script:

| Variable    | Description                         | Default           |
| ----------- | ----------------------------------- | ----------------- |
| `AUTH_USER` | Root username                       | `admin`           |
| `AUTH_PASS` | Root password                       | `admin`           |
| `DOMAIN`    | Local domain for HTTPS routing      | `myspinbot.local` |
| `DB_NAME`   | Root database name                  | `myspinbot`       |
| `FORCE`     | Overwrite existing secrets          | `false`           |

### Example: custom credentials + domain

```bash
AUTH_USER=myuser AUTH_PASS=SuperSecret DOMAIN=myspinbot.dev DB_NAME=myspinbot ./scripts/provision_secrets.sh
```

```powershell
$env:AUTH_USER = "myuser"
$env:AUTH_PASS = "SuperSecret"
$env:DOMAIN    = "myspinbot.dev"
$env:DB_NAME    = "myspinbot"
.\scripts\provision_secrets.ps1
```

### Example: force regeneration

```bash
FORCE=true ./scripts/provision_secrets.sh
```

## 🔒 Manual Credential Creation (Alternative)

If you prefer to manually define credentials (not recommended):

```bash
mkdir -p myspinbot/<target_dir>/secrets
cat > myspinbot/<target_dir>/secrets/root.env <<EOF
{UsernameEnvVar}=admin
{PasswordEnvVar}=UltraSecret
EOF
chmod 600 myspinbot/<target_dir>/secrets/root.env
```

## 🚫 Do Not Commit

All files in this directory are **sensitive** and must **never** be committed to Git.
They are ignored by default via `.gitignore`.

Only this README is tracked to document the folder’s purpose and preserve its structure.

## 🔁 Rotation

After regenerating credentials, restart the infra:

```bash
docker compose restart [ContainerNames]
```

## 🧭 Summary

| Property         | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| **Managed by**   | Developer / local provisioning script                     |
| **Contains**     | Root configuration (`root.env`)                           |
| **Security**     | Highly sensitive                                          |
| **Git status**   | Ignored                                                   |
| **Human action** | Generate locally via `scripts/provision_secrets.{sh,ps1}` |
