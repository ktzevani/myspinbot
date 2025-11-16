#!/usr/bin/env bash
set -euo pipefail

SCHEMAS_DIR="./common/config/schemas"
OUT_ROOT="./worker/src/worker/models"

echo "🐍 Generating Python Pydantic models..."

mkdir -p "$OUT_ROOT"

python -m datamodel_code_generator \
  --input "$SCHEMAS_DIR" \
  --input-file-type jsonschema \
  --output "$OUT_ROOT" \
  --output-model-type pydantic_v2.BaseModel

echo "✅ Python models generated into $OUT_ROOT"
