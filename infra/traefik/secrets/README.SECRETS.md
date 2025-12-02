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

For more information about how to use the provisioning scripts please refer to [provision_scripts.md](../../../docs/phase0/provision_scripts.md).