#!/bin/sh
if [ "$WORKER_ENVIRONMENT" = "development" ]; then
  echo "Running in development mode"
  python -Xfrozen_modules=off -m debugpy --listen 0.0.0.0:5678 -m worker.main
elif [ "$WORKER_ENVIRONMENT" = "production" ]; then
  echo "Running in production mode"
  python -m worker.main
fi