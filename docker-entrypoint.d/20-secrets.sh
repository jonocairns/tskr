#!/bin/sh

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
