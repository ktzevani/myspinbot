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

For more information about how to use the provisioning scripts please refer to [provision_scripts.md](../../../docs/phase0/provision_scripts.md).