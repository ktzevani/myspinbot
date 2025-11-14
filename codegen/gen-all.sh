#!/usr/bin/env bash
set -euo pipefail

./gen-backend-validators.sh
./gen-worker-datamodel.sh

echo "🎉 All models and validators regenerated!"
