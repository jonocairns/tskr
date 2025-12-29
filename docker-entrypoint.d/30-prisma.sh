#!/bin/sh

prisma_cli="/app/node_modules/prisma/build/index.js"
if [ ! -f "$prisma_cli" ]; then
  echo "Prisma CLI not found at $prisma_cli" >&2
  exit 1
fi

config_arg=""
if [ -f "./prisma.config.ts" ]; then
  config_arg="--config=./prisma.config.ts"
fi

if [ -d "./prisma/migrations" ] && [ "$(ls -A ./prisma/migrations 2>/dev/null)" ]; then
  echo "Running prisma migrate deploy..."
  node "$prisma_cli" migrate deploy $config_arg
else
  echo "No Prisma migrations found; skipping migrate deploy."
fi

  echo "Running db bootstrap..."
  node ./scripts/db-bootstrap.cjs
