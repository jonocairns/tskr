#!/bin/sh
set -e

default_db=0
if [ -z "$DATABASE_URL" ]; then
  DATABASE_URL="file:/data/dev.db"
  export DATABASE_URL
  default_db=1
  echo "DATABASE_URL not set; defaulting to $DATABASE_URL"
fi

fallback_to_tmp() {
  DATABASE_URL="file:/tmp/tskr.db"
  export DATABASE_URL
  echo "Database directory not writable; using $DATABASE_URL (not persistent)."
}

case "$DATABASE_URL" in
  file:*)
    db_path="${DATABASE_URL#file:}"
    if [ "${db_path#/}" = "$db_path" ] && [ "$default_db" = "1" ] && [ -d "/data" ]; then
      db_path="/data/${db_path#./}"
      DATABASE_URL="file:$db_path"
      export DATABASE_URL
      echo "DATABASE_URL was relative; using $DATABASE_URL"
    fi
    db_dir="$(dirname "$db_path")"
    if ! mkdir -p "$db_dir" 2>/dev/null || [ ! -w "$db_dir" ]; then
      if [ "$default_db" = "1" ]; then
        fallback_to_tmp
        db_path="/tmp/tskr.db"
      else
        echo "Database directory is not writable: $db_dir" >&2
        exit 1
      fi
    fi
    db_existed=1
    if [ ! -f "$db_path" ]; then
      : > "$db_path"
      db_existed=0
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

if [ -d "./prisma/migrations" ] && [ "$(ls -A ./prisma/migrations 2>/dev/null)" ]; then
  echo "Running prisma migrate deploy..."
  migrate_output="$(node "$prisma_cli" migrate deploy --schema=./prisma/schema.prisma $config_arg 2>&1)" || migrate_status=$?
  if [ -n "$migrate_output" ]; then
    echo "$migrate_output"
  fi
  if [ "${migrate_status:-0}" -ne 0 ]; then
    if echo "$migrate_output" | grep -q "P3005" && [ "$db_existed" = "1" ]; then
      echo "Existing database without migration history detected; baselining migrations."
      for migration in ./prisma/migrations/*; do
        [ -d "$migration" ] || continue
        migration_name="$(basename "$migration")"
        node "$prisma_cli" migrate resolve --schema=./prisma/schema.prisma $config_arg --applied "$migration_name"
      done
      echo "Re-running prisma migrate deploy..."
      node "$prisma_cli" migrate deploy --schema=./prisma/schema.prisma $config_arg
    else
      exit "${migrate_status:-1}"
    fi
  fi
elif [ "$db_existed" != "1" ]; then
  echo "Initializing database with prisma db push..."
  node "$prisma_cli" db push --schema=./prisma/schema.prisma $config_arg
else
  echo "Database already exists; skipping Prisma db push."
fi

exec "$@"
