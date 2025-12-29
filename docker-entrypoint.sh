#!/bin/sh
set -e

default_db=0
if [ -z "$DATABASE_URL" ]; then
  DATABASE_URL="file:/data/dev.db"
  export DATABASE_URL
  default_db=1
  echo "DATABASE_URL not set; defaulting to $DATABASE_URL"
fi

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
      echo "Database directory is not writable: $db_dir" >&2
      exit 1
    fi
    db_existed=1
    if [ ! -f "$db_path" ]; then
      : > "$db_path"
      db_existed=0
    fi
    ;;
esac

secrets_dir="/data"
secrets_file="$secrets_dir/tskr-secrets.env"

read_secret() {
  key="$1"
  if [ -z "$key" ] || [ ! -f "$secrets_file" ]; then
    return 1
  fi
  value="$(sed -n "s/^${key}=//p" "$secrets_file" | tail -n 1)"
  if [ -z "$value" ]; then
    return 1
  fi
  printf '%s' "$value"
}

write_secret() {
  key="$1"
  value="$2"
  if [ -z "$key" ] || [ -z "$value" ]; then
    return 0
  fi
  if [ ! -f "$secrets_file" ]; then
    (umask 077 && : > "$secrets_file")
  fi
  chmod 600 "$secrets_file" 2>/dev/null || true
  printf '%s=%s\n' "$key" "$value" >> "$secrets_file"
}

if [ -z "$NEXTAUTH_SECRET" ]; then
  if stored_secret="$(read_secret NEXTAUTH_SECRET)"; then
    NEXTAUTH_SECRET="$stored_secret"
    export NEXTAUTH_SECRET
  fi
fi
if [ -z "$NEXTAUTH_SECRET" ]; then
  if nextauth_secret="$(openssl rand -hex 32)"; then
    NEXTAUTH_SECRET="$nextauth_secret"
    export NEXTAUTH_SECRET
    write_secret NEXTAUTH_SECRET "$NEXTAUTH_SECRET"
    echo "Generated NEXTAUTH_SECRET."
  else
    echo "Failed to generate NEXTAUTH_SECRET; set it manually." >&2
    exit 1
  fi
fi

if [ -z "$VAPID_PUBLIC_KEY" ]; then
  if stored_vapid_public_key="$(read_secret VAPID_PUBLIC_KEY)"; then
    VAPID_PUBLIC_KEY="$stored_vapid_public_key"
    export VAPID_PUBLIC_KEY
  fi
fi
if [ -z "$VAPID_PRIVATE_KEY" ]; then
  if stored_vapid_private_key="$(read_secret VAPID_PRIVATE_KEY)"; then
    VAPID_PRIVATE_KEY="$stored_vapid_private_key"
    export VAPID_PRIVATE_KEY
  fi
fi
if [ -z "$VAPID_PUBLIC_KEY" ] && [ -z "$VAPID_PRIVATE_KEY" ]; then
  if vapid_keys="$(node -e "const webpush=require('web-push'); const keys=webpush.generateVAPIDKeys(); process.stdout.write(keys.publicKey + '\n' + keys.privateKey);")"; then
    vapid_public_key="$(printf '%s\n' "$vapid_keys" | sed -n '1p')"
    vapid_private_key="$(printf '%s\n' "$vapid_keys" | sed -n '2p')"
    if [ -n "$vapid_public_key" ] && [ -n "$vapid_private_key" ]; then
      VAPID_PUBLIC_KEY="$vapid_public_key"
      VAPID_PRIVATE_KEY="$vapid_private_key"
      export VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY
      write_secret VAPID_PUBLIC_KEY "$VAPID_PUBLIC_KEY"
      write_secret VAPID_PRIVATE_KEY "$VAPID_PRIVATE_KEY"
      echo "Generated VAPID keys."
    else
      echo "Failed to parse generated VAPID keys; set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY manually." >&2
    fi
  else
    echo "Failed to generate VAPID keys; set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY manually." >&2
  fi
elif [ -z "$VAPID_PUBLIC_KEY" ] || [ -z "$VAPID_PRIVATE_KEY" ]; then
  echo "VAPID keys are incomplete; set both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to enable push." >&2
fi

prisma_cli="/app/prisma-node_modules/node_modules/prisma/build/index.js"
if [ ! -f "$prisma_cli" ]; then
  prisma_cli="./node_modules/.bin/prisma"
fi
config_arg=""
schema_path="/app/prisma/schema.prisma"
config_path="/app/prisma.config.ts"
if [ -f "$config_path" ]; then
  config_arg="--config=$config_path"
fi

if [ -d "./prisma/migrations" ] && [ "$(ls -A ./prisma/migrations 2>/dev/null)" ]; then
  echo "Running prisma migrate deploy..."
  migrate_output="$(node "$prisma_cli" migrate deploy --schema="$schema_path" $config_arg 2>&1)" || migrate_status=$?
  if [ -n "$migrate_output" ]; then
    echo "$migrate_output"
  fi
elif [ "$db_existed" != "1" ]; then
  echo "Initializing database with prisma db push..."
  node "$prisma_cli" db push --schema="$schema_path" $config_arg
else
  echo "Database already exists; skipping Prisma db push."
fi

if [ -n "$SUPER_ADMIN_EMAIL" ] && [ -n "$SUPER_ADMIN_PASSWORD" ]; then
  echo "Running prisma db seed..."
  seed_dir="/app/seed"
  if [ -f "$seed_dir/package.json" ]; then
    (cd "$seed_dir" && node "$prisma_cli" db seed --schema="$schema_path" $config_arg)
  else
    echo "Skipping prisma db seed; seed package.json not found."
  fi
else
  echo "Skipping prisma db seed; SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD not set."
fi

exec "$@"
