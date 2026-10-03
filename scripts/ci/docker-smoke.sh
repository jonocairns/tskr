#!/usr/bin/env bash
set -euo pipefail

image=${1:?usage: docker-smoke.sh <image>}
container="tskr-smoke-${GITHUB_RUN_ID:-$$}-${GITHUB_RUN_ATTEMPT:-1}"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT

# Use an isolated container filesystem for its database; never mount appdata.
# Let the image supply HOSTNAME so the default bind address is exercised.
docker run --detach --name "$container" \
    --env PORT=3000 \
    --env NEXTAUTH_SECRET=ci-placeholder-secret \
    --env SUPER_ADMIN_EMAIL=smoke@example.invalid \
    --health-start-period=0s --health-interval=2s --health-timeout=3s \
    --health-retries=30 "$image" >/dev/null

for ((attempt = 0; attempt < 45; attempt++)); do
    state=$(docker inspect --format '{{.State.Status}}' "$container")
    health=$(docker inspect --format '{{.State.Health.Status}}' "$container")
    if [[ "$state" == running && "$health" == healthy ]]; then
        docker exec "$container" curl -fsS http://localhost:3000/api/health
        echo
        echo "Container migrated its database, bootstrapped, and passed its health check and localhost probe."
        exit 0
    fi
    if [[ "$state" != running || "$health" == unhealthy ]]; then
        break
    fi
    sleep 2
done

docker logs "$container" >&2
docker inspect --format '{{json .State}}' "$container" >&2
echo "ERROR: container did not become healthy" >&2
exit 1
