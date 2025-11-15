#!/usr/bin/env bash
set -euo pipefail

SCHEMAS_DIR="./common/config/schemas"
OUT_ROOT="./worker/src/worker/models"

echo "🐍 Generating Python Pydantic models..."

rm -rf "$OUT_ROOT"
mkdir -p "$OUT_ROOT"

python -m datamodel_code_generator \
  --input "$SCHEMAS_DIR" \
  --input-file-type jsonschema \
  --output "$OUT_ROOT"

echo "✅ Python models generated into $OUT_ROOT"
