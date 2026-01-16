#!/usr/bin/env bash
set -euo pipefail

./infra/codegen/gen-backend-validators.sh
./infra/codegen/gen-worker-datamodel.sh

echo "🎉 All models and validators regenerated!"
