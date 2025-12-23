#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
flake_file="$root_dir/flake.nix"
target=".#pnpmDeps"
tmp_log="$(mktemp)"

cleanup() {
  rm -f "$tmp_log"
}
trap cleanup EXIT

cd "$root_dir"

if nix build "$target" --no-link 2> "$tmp_log"; then
  echo "pnpm deps hash is already up to date."
  exit 0
fi

hash_line="$(grep -Eo "got: sha256-[A-Za-z0-9+/=]+" "$tmp_log" | tail -n 1)"
hash_value="${hash_line#got: }"
hash_value="$(printf '%s' "$hash_value" | sed -E 's/^[[:space:]]+//;s/[[:space:]]+$//')"

if [ -z "$hash_value" ]; then
  echo "Failed to locate the expected hash in nix output."
  echo "Log:"
  cat "$tmp_log"
  exit 1
fi

if ! grep -q "pnpmDeps = pkgs.fetchPnpmDeps" "$flake_file"; then
  echo "pnpmDeps fetchDeps block not found in flake.nix"
  exit 1
fi

tmp_file="$(mktemp)"
awk -v new_hash="$hash_value" '
  $0 ~ /pnpmDeps[[:space:]]*=[[:space:]]*pnpm\.fetchDeps/ { in_block=1 }
  in_block && $0 ~ /hash[[:space:]]*=/ {
    sub(/hash[[:space:]]*=[^;]+;/, "hash = \"" new_hash "\";");
    in_block=0
  }
  { print }
' "$flake_file" > "$tmp_file"
mv "$tmp_file" "$flake_file"

echo "Updated pnpmDeps hash to $hash_value"
echo "Rebuilding $target to verify..."
nix build "$target" --no-link
