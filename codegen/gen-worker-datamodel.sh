#!/usr/bin/env bash
set -euo pipefail

SCHEMAS_DIR="./common/config/schemas"
OUT_ROOT="./worker/src/worker/models"

echo "🐍 Generating Python Pydantic models..."
mkdir -p "$OUT_ROOT"

find "$SCHEMAS_DIR" -type f -name "*.json" | while IFS= read -r schema; do
  rel_path="${schema#"$SCHEMAS_DIR"/}"

  schema_dir="$(dirname "$rel_path")"
  base="$(basename "$schema" .json)"

  out_dir="$OUT_ROOT/$schema_dir"
  mkdir -p "$out_dir"

  # hyphen-safe python filenames
  py_name="${base//-/_}.py"
  out_file="$out_dir/$py_name"

  echo " → $schema"
  echo "   → $out_file"

  python -m datamodel_code_generator \
    --input "$schema" \
    --input-file-type jsonschema \
    --output "$out_file"
done

echo "✅ Python models generated (directory structure preserved)."
