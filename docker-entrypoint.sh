#!/bin/sh
set -e

script_dir="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
entrypoint_dir="$script_dir/docker-entrypoint.d"

if [ -d "$entrypoint_dir" ]; then
  for script in "$entrypoint_dir"/*.sh; do
    [ -f "$script" ] || continue
    # shellcheck disable=SC1090
    . "$script"
  done
else
  echo "Missing entrypoint scripts in $entrypoint_dir" >&2
  exit 1
fi

exec "$@"
