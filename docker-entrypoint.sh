#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set; skipping Prisma migrations."
else
  case "$DATABASE_URL" in
    file:*)
      db_path="${DATABASE_URL#file:}"
      db_dir="$(dirname "$db_path")"
      if [ ! -d "$db_dir" ]; then
        mkdir -p "$db_dir"
      fi
      if [ ! -f "$db_path" ]; then
        : > "$db_path"
      fi
      ;;
  esac
  prisma_cli="/app/prisma-node_modules/node_modules/prisma/build/index.js"
  if [ ! -f "$prisma_cli" ]; then
    prisma_cli="./node_modules/.bin/prisma"
  fi
  config_arg=""
  if [ -f "./prisma.config.ts" ]; then
    config_arg="--config=./prisma.config.ts"
  fi
  if [ -d "./prisma/migrations" ] && [ "$(ls -A ./prisma/migrations)" ]; then
    echo "Running prisma migrate deploy..."
    node "$prisma_cli" migrate deploy --schema=./prisma/schema.prisma $config_arg
  else
    echo "Running prisma db push..."
    node "$prisma_cli" db push --schema=./prisma/schema.prisma $config_arg
  fi
fi

exec "$@"
