#!/bin/sh
if [ "$NODE_ENV" = "development" ]; then
  echo "Running in development mode"
  exec node --inspect=0.0.0.0:9229 src/index.js
elif [ "$NODE_ENV" = "production" ]; then
  echo "Running in production mode"
  exec node src/index.js
fi
