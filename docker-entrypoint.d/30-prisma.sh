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
  if [ -n "$DATABASE_URL" ] && [ "${DATABASE_URL#file:}" != "$DATABASE_URL" ]; then
    db_path="${DATABASE_URL#file:}"
    if [ -f "$db_path" ]; then
      backup_dir="${DB_BACKUP_DIR:-/data/backups}"
      if ! mkdir -p "$backup_dir" 2>/dev/null || [ ! -w "$backup_dir" ]; then
        echo "Backup directory is not writable: $backup_dir" >&2
        exit 1
      fi
      db_name="$(basename "$db_path")"
      backup_path="$backup_dir/${db_name}.bak.$(date -u +%Y%m%d%H%M%S)"
      echo "Backing up database to $backup_path..."
      cp -p "$db_path" "$backup_path"
      backup_keep="${DB_BACKUP_KEEP:-3}"
      if [ "$backup_keep" -gt 0 ] 2>/dev/null; then
        i=0
        for file in $(ls -1t "$backup_dir/${db_name}.bak."* 2>/dev/null); do
          i=$((i + 1))
          if [ "$i" -gt "$backup_keep" ]; then
            rm -f "$file"
          fi
        done
      fi
    fi
  fi
  echo "Running prisma migrate deploy..."
  node "$prisma_cli" migrate deploy $config_arg
else
  echo "No Prisma migrations found; skipping migrate deploy."
fi

echo "Running db bootstrap..."
node ./scripts/db-bootstrap.cjs
