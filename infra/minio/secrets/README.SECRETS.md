# 🔐 MySpinBot Local Secrets — MinIO

This directory stores **local secret files** used by the MySpinBot MinIO service
for authentication and private S3 API access.
It is **excluded from Git** for security reasons, as it contains sensitive
credentials that must exist only on your local machine or within a protected CI/CD environment.

## 🗁️ Expected Local Files

| File       | Purpose                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `root.env` | Defines `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` used by the MinIO server for S3 API and console authentication |

## 🧰 Provisioning Secrets

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
2. Generate a `root.env` file synchronized with Traefik BasicAuth credentials
3. Set secure file permissions (`chmod 600`)
4. Keep this file **outside of version control**

## ⚙️ Environment Overrides

You can customize credentials and domain using environment variables before running the script:

| Variable    | Description                                     | Default           |
| ----------- | ----------------------------------------------- | ----------------- |
| `AUTH_USER` | MinIO root username (synchronized with Traefik) | `admin`           |
| `AUTH_PASS` | MinIO root password (synchronized with Traefik) | `admin`           |
| `DOMAIN`    | Local domain for HTTPS routing                  | `myspinbot.local` |
| `FORCE`     | Overwrite existing secrets                      | `false`           |

### Example: custom credentials + domain

```bash
AUTH_USER=myuser AUTH_PASS=SuperSecret DOMAIN=myspinbot.dev ./scripts/provision_secrets.sh
```

```powershell
$env:AUTH_USER = "myuser"
$env:AUTH_PASS = "SuperSecret"
$env:DOMAIN    = "myspinbot.dev"
.\scripts\provision_secrets.ps1
```

### Example: force regeneration

```bash
FORCE=true ./scripts/provision_secrets.sh
```

## 🔒 Manual Credential Creation (Alternative)

If you prefer to manually define credentials (not recommended):

```bash
mkdir -p myspinbot/minio/secrets
cat > myspinbot/minio/secrets/root.env <<EOF
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=UltraSecret
EOF
chmod 600 myspinbot/minio/secrets/root.env
```

## 🚫 Do Not Commit

All files in this directory are **sensitive** and must **never** be committed to Git.
They are ignored by default via `.gitignore`.

Only this README is tracked to document the folder’s purpose and preserve its structure.

## 🔁 Rotation

After regenerating credentials, restart the MinIO container:

```bash
docker compose restart minio
```

## 🧭 Summary

| Property         | Value                                               |
| ---------------- | --------------------------------------------------- |
| **Managed by**   | Developer / local provisioning script               |
| **Contains**     | MinIO root credentials (`root.env`)                 |
| **Security**     | Highly sensitive                                    |
| **Git status**   | Ignored                                             |
| **Human action** | Generate locally via `scripts/provision_secrets.sh` |
