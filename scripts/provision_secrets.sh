#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────
# 🌀 MySpinBot — Local Secrets, Certificates & MinIO Provisioning
# Phase 0 (Infra Bootstrap)
#
# Generates:
#   • BasicAuth credentials (htpasswd) for Traefik
#   • MinIO root credentials synchronized with Traefik
#   • Wildcard TLS certificates (mkcert) for local HTTPS
#
# Supports environment overrides:
#   AUTH_USER=admin AUTH_PASS=secret DOMAIN=myspinbot.local ./scripts/provision_secrets.sh
#
# Dependencies: htpasswd, mkcert, openssl (optional)
# ────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration (defaults, overridable) ───────────────────────
AUTH_USER="${AUTH_USER:-admin}"
AUTH_PASS="${AUTH_PASS:-password}"
DOMAIN="${DOMAIN:-myspinbot.local}"
FORCE="${FORCE:-false}"  # set FORCE=true to overwrite existing files

# ── Directory setup ─────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRAEFIK_SECRETS_DIR="$ROOT_DIR/traefik/secrets"
CERTS_DIR="$ROOT_DIR/traefik/certs"
MINIO_SECRETS_DIR="$ROOT_DIR/minio/secrets"

echo "🔧 [MySpinBot] Provisioning local secrets and certificates..."
echo "   → Domain: $DOMAIN"
echo "   → User:   $AUTH_USER"

mkdir -p "$TRAEFIK_SECRETS_DIR" "$CERTS_DIR" "$MINIO_SECRETS_DIR"

# ── 1️⃣ Generate BasicAuth credentials for Traefik ───────────────
HTPASSWD_FILE="$TRAEFIK_SECRETS_DIR/htpasswd"

if command -v htpasswd &>/dev/null; then
  if [[ "$FORCE" == "true" || ! -f "$HTPASSWD_FILE" ]]; then
    echo "→ Generating BasicAuth file for Traefik..."
    htpasswd -cbB "$HTPASSWD_FILE" "$AUTH_USER" "$AUTH_PASS"
    echo "   Created credentials: $AUTH_USER / $AUTH_PASS"
  else
    echo "→ BasicAuth file already exists (use FORCE=true to regenerate)."
  fi
else
  echo "⚠️ 'htpasswd' not found — please install Apache utils first:"
  echo "   Debian/Ubuntu: sudo apt install apache2-utils"
  echo "   macOS (brew):  brew install httpd"
fi

# ── 2️⃣ Generate MinIO root credentials synchronized with Traefik ────────────
MINIO_ENV_FILE="$MINIO_SECRETS_DIR/root.env"

if [[ "$FORCE" == "true" || ! -f "$MINIO_ENV_FILE" ]]; then
  echo "→ Generating MinIO root.env (synchronized with Traefik BasicAuth)..."
  {
    echo "MINIO_ROOT_USER=${AUTH_USER}"
    echo "MINIO_ROOT_PASSWORD=${AUTH_PASS}"
    echo "MINIO_ACCESS_KEY=${AUTH_USER}"
    echo "MINIO_SECRET_KEY=${AUTH_PASS}"
  } >"$MINIO_ENV_FILE"
  chmod 600 "$MINIO_ENV_FILE"
  echo "   Created MinIO root.env: $MINIO_ENV_FILE"
else
  echo "→ MinIO root.env already exists (use FORCE=true to regenerate)."
fi

# ── 3️⃣ Generate local wildcard TLS certificate ─────────────────
if command -v mkcert &>/dev/null; then
  CRT="$CERTS_DIR/wildcard-$DOMAIN.crt"
  KEY="$CERTS_DIR/wildcard-$DOMAIN.key"

  if [[ "$FORCE" == "true" || ! -f "$CRT" || ! -f "$KEY" ]]; then
    echo "→ Generating wildcard certificate for *.$DOMAIN ..."
    mkcert -install >/dev/null 2>&1 || true
    mkcert -cert-file "$CRT" -key-file "$KEY" "*.$DOMAIN"
    echo "   Certificate created at:"
    echo "     $CRT"
    echo "     $KEY"
  else
    echo "→ Certificate files already exist (use FORCE=true to regenerate)."
  fi
else
  echo "⚠️ 'mkcert' not found — please install it:"
  echo "   https://github.com/FiloSottile/mkcert"
fi

# ── 4️⃣ Permissions sanity check ─────────────────────────────────
chmod 600 "$TRAEFIK_SECRETS_DIR"/htpasswd 2>/dev/null || true
chmod 600 "$CERTS_DIR"/*.key 2>/dev/null || true
chmod 600 "$MINIO_ENV_FILE" 2>/dev/null || true

# ── 5️⃣ Final summary ────────────────────────────────────────────
MINIO_DOMAIN="s3.$DOMAIN"
echo ""
echo "--- [MySpinBot] Provisioning Summary ---"
printf "   → BasicAuth user:  %s\n" "$AUTH_USER"
printf "   → Domain:          %s\n" "$DOMAIN"
printf "   → Traefik secrets: %s\n" "$TRAEFIK_SECRETS_DIR"
printf "   → MinIO secrets:   %s\n" "$MINIO_SECRETS_DIR"
printf "   → Certificates:    %s\n" "$CERTS_DIR"
echo ""
echo "✅  Access MinIO Console at: https://$MINIO_DOMAIN"
echo "    Username: $AUTH_USER"
echo "    Password: (stored in minio/secrets/root.env)"
echo ""
echo "✅ [MySpinBot] Local provisioning complete."
