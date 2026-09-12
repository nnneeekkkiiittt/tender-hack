#!/usr/bin/env bash
set -euo pipefail
backend_test_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
backend_test_container="$(docker run --detach --rm --tmpfs /var/lib/postgresql/data:rw \
    -p 127.0.0.1::5432 -e POSTGRES_PASSWORD=test-only -e POSTGRES_DB=tender_test postgres:17)"
trap 'docker rm -f "$backend_test_container" >/dev/null' EXIT
for attempt in {1..60}; do
    if docker exec "$backend_test_container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
    if [[ "$attempt" = 60 ]]; then docker logs "$backend_test_container"; exit 1; fi
    sleep 1
done
backend_test_address="$(docker port "$backend_test_container" 5432/tcp)"
export TEST_DATABASE_URL="postgresql://postgres:test-only@$backend_test_address/tender_test"
cd "$backend_test_dir"
uv run pytest -q "$@"
