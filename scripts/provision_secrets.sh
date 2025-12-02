#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────
# 🌀 MySpinBot — Local Secrets, Certificates & MinIO Provisioning
# Phase 0 (Infra Bootstrap)
#
# Generates:
#   • BasicAuth credentials (htpasswd) for Traefik
#   • Wildcard TLS certificates (mkcert) for local HTTPS
#   • Infrastructure facilities credentials synchronized with Traefik
#
# Supports environment overrides:
#   AUTH_USER=admin AUTH_PASS=secret DOMAIN=myspinbot.local \
#     DB_NAME=myspinbot ./scripts/provision_secrets.sh
#
# Dependencies: htpasswd, mkcert, openssl (optional)
# ────────────────────────────────────────────────────────────────

set -euo pipefail

expand_template() {
  local template_file="$1"
  local output_file="$2"
  if [[ ! -f "$template_file" ]]; then
    echo "Error: template '$template_file' does not exist" >&2
    exit 1
  fi
  {
    while IFS='' read -r line || [[ -n "$line" ]]; do
      while [[ "$line" =~ \$\{([A-Za-z_][A-Za-z0-9_]*)\} ]]; do
        var="${BASH_REMATCH[1]}"
        if [[ -z "${!var+x}" ]]; then
          echo "Error: variable '$var' is not defined in the environment" >&2
          exit 1
        fi
        value="${!var}"
        line="${line/\$\{$var\}/$value}"
      done
      printf '%s\n' "$line"
    done < "$template_file"
  } > "$output_file"
}

# ── Configuration (defaults, overridable) ───────────────────────
AUTH_USER="${AUTH_USER:-admin}"
AUTH_PASS="${AUTH_PASS:-password}"
DOMAIN="${DOMAIN:-myspinbot.local}"
DB_NAME="${DB_NAME:-myspinbot}"
FORCE="${FORCE:-false}"  # set FORCE=true to overwrite existing files

# ── Directory setup ─────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="$ROOT_DIR/infra"
TRAEFIK_SECRETS_DIR="$INFRA_DIR/traefik/secrets"
CERTS_DIR="$INFRA_DIR/traefik/certs"
API_SECRETS_DIR="$ROOT_DIR/backend/secrets"
GRAFANA_SECRETS_DIR="$INFRA_DIR/grafana/secrets"
MINIO_SECRETS_DIR="$INFRA_DIR/minio/secrets"
PG_SECRETS_DIR="$INFRA_DIR/postgres/secrets"

echo "🔧 [MySpinBot] Provisioning local secrets and certificates..."
echo "   → Domain: $DOMAIN"
echo "   → User:   $AUTH_USER"

mkdir -p "$TRAEFIK_SECRETS_DIR" "$CERTS_DIR" "$GRAFANA_SECRETS_DIR" "$MINIO_SECRETS_DIR" "$PG_SECRETS_DIR"

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

# ── 2️⃣ Generate facilities foundational configs ────────────
ROOT_ENV_FILE="$ROOT_DIR/.env"

if [[ "$FORCE" == "true" || ! -f "$ROOT_ENV_FILE" ]]; then
  echo "→ Generating root .env ..."
  {
    echo "PROJECT_DOMAIN=${DOMAIN}"
  } >"$ROOT_ENV_FILE"
  chmod 600 "$ROOT_ENV_FILE"
  echo "   Created root .env: $ROOT_ENV_FILE"
else
  echo "→ Root .env already exists (use FORCE=true to regenerate)."
fi

GRAFANA_ENV_FILE="$GRAFANA_SECRETS_DIR/root.env"
GRAFANA_URL="grafana.$DOMAIN"

if [[ "$FORCE" == "true" || ! -f "$GRAFANA_ENV_FILE" ]]; then
  echo "→ Generating Grafana root.env (synchronized with Traefik BasicAuth)..."
  {
    echo "GF_SECURITY_ADMIN_USER=${AUTH_USER}"
    echo "GF_SECURITY_ADMIN_PASSWORD=${AUTH_PASS}"
    echo "GF_SERVER_DOMAIN=${GRAFANA_URL}"
  } >"$GRAFANA_ENV_FILE"
  chmod 600 "$GRAFANA_ENV_FILE"
  echo "   Created Grafana root.env: $GRAFANA_ENV_FILE"
else
  echo "→ Grafana root.env already exists (use FORCE=true to regenerate)."
fi

MINIO_ENV_FILE="$MINIO_SECRETS_DIR/root.env"
MINIO_URL="s3.$DOMAIN"

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

PG_ENV_FILE="$PG_SECRETS_DIR/root.env"
PGADMIN_URL="pgadmin.$DOMAIN"

POSTGRES_USER="$AUTH_USER"
POSTGRES_PASSWORD="$AUTH_PASS"
POSTGRES_DB="$DB_NAME"

if [[ "$FORCE" == "true" || ! -f "$PG_ENV_FILE" ]]; then
  echo "→ Generating PostgreSQL root.env (synchronized with Traefik BasicAuth)..."
  {
    echo "POSTGRES_USER=${POSTGRES_USER}"
    echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
    echo "PGADMIN_DEFAULT_EMAIL=${AUTH_USER}@${DOMAIN}"
    echo "PGADMIN_DEFAULT_PASSWORD=${AUTH_PASS}"
    echo "POSTGRES_DB=${POSTGRES_DB}"
  } >"$PG_ENV_FILE"
  chmod 600 "$PG_ENV_FILE"
  echo "   Created PostgreSQL root.env: $PG_ENV_FILE"
else
  echo "→ PostgreSQL root.env already exists (use FORCE=true to regenerate)."
fi

PGADMIN_TEMPLATE="$INFRA_DIR/postgres/pgadmin/servers.json.template"
PGADMIN_OUTPUT="$INFRA_DIR/postgres/pgadmin/servers.json"

if [[ "$FORCE" == "true" || ! -f "$PGADMIN_TEMPLATE" ]]; then
  echo "→ Generating PgAdmin servers.json ..."
  expand_template "$PGADMIN_TEMPLATE" "$PGADMIN_OUTPUT"
  echo " Created PgAdmin servers.json: $PGADMIN_OUTPUT"
else
  echo "→ PgAdmin servers.json already exists (use FORCE=true to regenerate)."
fi

API_ENV_FILE="$API_SECRETS_DIR/root.env"
API_URL="api.$DOMAIN"

if [[ "$FORCE" == "true" || ! -f "$API_ENV_FILE" ]]; then
  echo "→ Generating Backend root.env (synchronized with Traefik BasicAuth)..."
  {
    echo "POSTGRES_URL=postgres://${AUTH_USER}:${AUTH_PASS}@postgres:5432/${DB_NAME}"
  } >"$API_ENV_FILE"
  chmod 600 "$API_ENV_FILE"
  echo "   Created Backend root.env: $API_ENV_FILE"
else
  echo "→ Backend root.env already exists (use FORCE=true to regenerate)."
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
chmod 600 "$ROOT_ENV_FILE" 2>/dev/null || true
chmod 600 "$GRAFANA_ENV_FILE" 2>/dev/null || true
chmod 600 "$MINIO_ENV_FILE" 2>/dev/null || true
chmod 600 "$PG_ENV_FILE" 2>/dev/null || true
chmod 600 "$API_ENV_FILE" 2>/dev/null || true

# ── 5️⃣ Final summary ────────────────────────────────────────────
echo ""
echo "--- [MySpinBot] Provisioning Summary ---"
printf "   → BasicAuth user:  %s\n" "$AUTH_USER"
printf "   → Domain:          %s\n" "$DOMAIN"
printf "   → Project Root: %s\n" "$ROOT_DIR"
printf "   → Certificates:    %s\n" "$CERTS_DIR"
printf "   → Traefik secrets: %s\n" "$TRAEFIK_SECRETS_DIR"
printf "   → Grafana secrets:   %s\n" "$GRAFANA_SECRETS_DIR"
printf "   → MinIO secrets:   %s\n" "$MINIO_SECRETS_DIR"
printf "   → PostgreSQL secrets:   %s\n" "$PG_SECRETS_DIR"
printf "   → Backend secrets:   %s\n" "$API_SECRETS_DIR"
echo ""
echo "✅  Access MinIO Console at: https://$MINIO_URL"
echo "    Username: $AUTH_USER"
echo "    Password: (stored in $MINIO_ENV_FILE)"
echo ""
echo "✅  Access Grafana web ui at: https://$GRAFANA_URL"
echo "    Username: $AUTH_USER"
echo "    Password: (stored in $GRAFANA_ENV_FILE)"
echo ""
echo "✅  Access pgAdmin at: https://$PGADMIN_URL"
echo "    Username: $AUTH_USER"
echo "    Password: (stored in $PG_ENV_FILE)"
echo ""
echo "✅  Access Backend API at: https://$API_URL"
echo ""
echo "✅ [MySpinBot] Local provisioning complete."
