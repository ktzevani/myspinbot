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

  out_file="$out_dir/${base}Validator.cjs"

  echo " → $schema"
  echo "   → $out_file"

  ref_args=""
  while IFS= read -r f; do
    # Skip the main schema we are compiling
    if [ "$f" != "$schema" ]; then
      ref_args="$ref_args -r $f"
    fi
  done < <(find "$SCHEMAS_DIR" -type f -name "*.json")

  npx ajv compile \
    --spec=draft2020 \
    --strict=false \
    --code-lines \
    --code-es5 \
    --inline-refs=true \
    -c ajv-formats \
    -s "$schema" \
    $ref_args \
    -o "$out_file" 

  echo "-s $schema"
  echo "$ref_args"
  echo "-o $out_file"

done

echo "✅ JS validators generated (directory structure preserved)."