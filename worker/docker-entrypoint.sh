#!/bin/sh
if [ "$WORKER_ENVIRONMENT" = "development" ]; then
  MARKER="/.container_initialized"
  if [ ! -f "$MARKER" ]; then
      echo "Proceeding to container initial configuration…"
      cd "$WORKER_HOME" || exit
      uv pip install -e .[dev]
      touch "$MARKER"
  else
      echo "Container is initialized - skipping."
  fi
  echo "Running in development mode"
  tail -f /dev/null
  # python -Xfrozen_modules=off -m debugpy --listen 0.0.0.0:5678 -m worker.main
elif [ "$WORKER_ENVIRONMENT" = "production" ]; then
  echo "Running in production mode"
  myspinbot-worker
fi