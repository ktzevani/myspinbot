#!/usr/bin/env bash
set -e
echo "Starting container…"
MARKER="/.sageattention_built"
# Ensure GPU is visible
if ! command -v nvidia-smi >/dev/null 2>&1; then
    echo "ERROR: No GPU detected (nvidia-smi missing)."
    exit 1
fi
if [ ! -f "$MARKER" ]; then
    echo "SageAttention not built yet — building now (runtime, one-time)…"
    # Root SageAttention (v1/v2/v2++)
    uv pip install --no-build-isolation git+https://github.com/thu-ml/SageAttention.git
    # v3 (blackwell)
    git clone https://github.com/thu-ml/SageAttention.git /tmp/SageAttention
    cd /tmp/SageAttention/sageattention3_blackwell
    python setup.py install
    cd /
    rm -rf /tmp/SageAttention
    touch "$MARKER"
    echo "SageAttention build complete."
else
    echo "SageAttention already built — skipping."
fi
read -r -a CLI_ARGS_ARR <<< "$CLI_ARGS"
if [ "$WORKER_ENVIRONMENT" = "production" ]; then
    echo "Running in production mode"
    exec python "$WORKER_HOME/main.py" "${CLI_ARGS_ARR[@]}"
elif [ "$WORKER_ENVIRONMNENT" = "development" ]; then
    echo "Running in development mode"
    exec python -Xfrozen_modules=off -m debugpy --listen 0.0.0.0:5678 "$WORKER_HOME/main.py" "${CLI_ARGS_ARR[@]}"
fi