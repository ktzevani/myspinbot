#!/bin/sh
# ===============================================================
# 🪣 MySpinBot — MinIO Bucket Bootstrap Script
# ===============================================================
# This script:
#   • Starts the MinIO server
#   • Waits until it becomes reachable
#   • Creates all buckets listed in $MINIO_BUCKETS (if missing)
# ===============================================================

set -e

echo "🚀 Starting MinIO server..."
minio server /data --console-address ":9001" --anonymous &
MINIO_PID=$!

# ---- Wait for API to become reachable ---------------------------------------
echo "⏳ Waiting for MinIO to start..."
until curl -s http://localhost:9000/minio/health/ready >/dev/null 2>&1; do
  sleep 1
done
echo "✅ MinIO is reachable."

# ---- Ensure MinIO client exists ---------------------------------------------
if ! command -v mc >/dev/null 2>&1; then
  echo "📦 Installing MinIO client (mc)..."
  curl -sSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc
  chmod +x /usr/local/bin/mc
fi

echo "🔐 Configuring MinIO client alias..."
mc alias set local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

if [ ! -f /data/.initialized ]; then
  echo "🧺 Creating buckets: $MINIO_BUCKETS"
  for bucket in $MINIO_BUCKETS; do
    echo "  -> Ensuring bucket '$bucket' exists..."
    mc mb --ignore-existing local/"$bucket" || true
    mc anonymous set download local/"$bucket" || true
  done
  touch /data/.initialized
echo "✅ Bucket bootstrap complete."
fi

echo "🟢 MinIO service running."
wait $MINIO_PID