#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set; skipping Prisma migrations."
else
  prisma_cli="/app/prisma-node_modules/node_modules/prisma/build/index.js"
  if [ ! -f "$prisma_cli" ]; then
    prisma_cli="./node_modules/.bin/prisma"
  fi
  if [ -d "./prisma/migrations" ] && [ "$(ls -A ./prisma/migrations)" ]; then
    echo "Running prisma migrate deploy..."
    node "$prisma_cli" migrate deploy --schema=./prisma/schema.prisma
  else
    echo "Running prisma db push..."
    node "$prisma_cli" db push --schema=./prisma/schema.prisma
  fi
fi

exec "$@"
