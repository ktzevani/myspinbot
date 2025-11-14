#!/usr/bin/env bash
set -euo pipefail

SCHEMAS_DIR="./common/config/schemas"
OUT_ROOT="./backend/src/validators"

echo "📦 Generating JS validators (AJV)..."
mkdir -p "$OUT_ROOT"

find "$SCHEMAS_DIR" -type f -name "*.json" | while IFS= read -r schema; do
  # Remove prefix safely
  rel_path="${schema#"$SCHEMAS_DIR"/}"

  schema_dir="$(dirname "$rel_path")"
  base="$(basename "$schema" .json)"

  out_dir="$OUT_ROOT/$schema_dir"
  mkdir -p "$out_dir"

  out_file="$out_dir/${base}Validator.js"

  echo " → $schema"
  echo "   → $out_file"

  npx ajv compile \
    -s "$schema" \
    -o "$out_file" \
    --strict=false
done

echo "✅ JS validators generated (directory structure preserved)."