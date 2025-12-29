#!/bin/sh

prisma_cli="/app/prisma-node_modules/node_modules/prisma/build/index.js"
if [ ! -f "$prisma_cli" ]; then
  prisma_cli="./node_modules/.bin/prisma"
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

if [ -n "$SUPER_ADMIN_EMAIL" ] && [ -n "$SUPER_ADMIN_PASSWORD" ]; then
  echo "Running prisma db seed..."
  node "$prisma_cli" db seed $config_arg
else
  echo "Skipping prisma db seed; SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD not set."
fi
