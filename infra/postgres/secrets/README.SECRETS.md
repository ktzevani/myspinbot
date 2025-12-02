# 🔐 PostgreSQL Local Secrets

This directory stores **local secret files** used by the MySpinBot Postgresql persistence service
for authentication.
It is **excluded from Git** for security reasons, as it contains sensitive
credentials that must exist only on your local machine or within a protected CI/CD environment.

## 🗁️ Expected Local Files

| File       | Purpose                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `root.env` | Defines PostgreSQL/pgAdmin credentials (`POSTGRES_USER`, `POSTGRES_PASSWORD`) root database name |

## 🧰 Provisioning Secrets

For more information about how to use the provisioning scripts please refer to [provision_scripts.md](../../../docs/phase0/provision_scripts.md).