#!/usr/bin/env bash
set -e
echo "Starting container…"
# Ensure GPU is visible
if ! command -v nvidia-smi >/dev/null 2>&1; then
    echo "ERROR: No GPU detected (nvidia-smi missing)."
    exit 1
fi
read -r -a CLI_ARGS_ARR <<< "$CLI_ARGS"
if [ "$WORKER_ENVIRONMENT" = "production" ]; then
    echo "Running in production mode"
    exec python "$WORKER_HOME/main.py" "${CLI_ARGS_ARR[@]}"
elif [ "$WORKER_ENVIRONMNENT" = "development" ]; then
    echo "Running in development mode"
    exec python -Xfrozen_modules=off -m debugpy --listen 0.0.0.0:5678 "$WORKER_HOME/main.py" "${CLI_ARGS_ARR[@]}"
fi