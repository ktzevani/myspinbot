#!/usr/bin/env bash
set -euo pipefail

./codegen/gen-backend-validators.sh
./codegen/gen-worker-datamodel.sh

echo "🎉 All models and validators regenerated!"
