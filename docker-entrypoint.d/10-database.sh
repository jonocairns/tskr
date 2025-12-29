#!/bin/sh

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
    if [ ! -f "$db_path" ]; then
      : > "$db_path"
    fi
    ;;
esac
