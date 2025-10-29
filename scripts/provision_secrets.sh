#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────
# MySpinBot — Local Secret & Certificate Provisioning Script
# Phase 0 (Infra Bootstrap)
#
# Generates BasicAuth credentials and wildcard TLS certificates
# for Traefik-based HTTPS routing.
#
# Supports environment overrides:
#   AUTH_USER=admin AUTH_PASS=secret DOMAIN=myspinbot.local ./scripts/provision_secrets.sh
#
# Dependencies: htpasswd, mkcert
# ────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration (defaults, overridable) ───────────────────────
AUTH_USER="${AUTH_USER:-admin}"
AUTH_PASS="${AUTH_PASS:-admin}"
DOMAIN="${DOMAIN:-myspinbot.local}"
FORCE="${FORCE:-false}"     # set FORCE=true to overwrite existing files

# ── Directory setup ─────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SECRETS_DIR="$ROOT_DIR/traefik/secrets"
CERTS_DIR="$ROOT_DIR/traefik/certs"

echo "🔧 [MySpinBot] Provisioning local secrets and certificates..."
echo "   → Domain: $DOMAIN"
echo "   → User:   $AUTH_USER"
mkdir -p "$SECRETS_DIR" "$CERTS_DIR"

# ── 1️⃣ Generate BasicAuth credentials ───────────────────────────
if command -v htpasswd &>/dev/null; then
  HTPASSWD_FILE="$SECRETS_DIR/htpasswd"

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

# ── 2️⃣ Generate local wildcard certificate ───────────────────────
if command -v mkcert &>/dev/null; then
  CRT="$CERTS_DIR/wildcard-$DOMAIN.crt"
  KEY="$CERTS_DIR/wildcard-$DOMAIN.key"

  if [[ "$FORCE" == "true" || ! -f "$CRT" || ! -f "$KEY" ]]; then
    echo "→ Generating wildcard certificate for *.$DOMAIN"
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

# ── 3️⃣ Permissions sanity check ─────────────────────────────────
chmod 600 "$SECRETS_DIR"/htpasswd 2>/dev/null || true
chmod 600 "$CERTS_DIR"/*.key 2>/dev/null || true

# ── 4️⃣ Summary ─────────────────────────────────────────────────
echo "✅ [MySpinBot] Provisioning complete."
echo "   Secrets directory: $SECRETS_DIR"
echo "   Certificates:      $CERTS_DIR"
