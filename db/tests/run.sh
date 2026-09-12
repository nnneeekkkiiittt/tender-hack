#!/usr/bin/env bash
set -euo pipefail
schema_test_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
schema_test_container="$(docker run --detach --rm --network none --tmpfs /var/lib/postgresql/data:rw \
    -e POSTGRES_PASSWORD=schema-test-only -e POSTGRES_DB=schema_test postgres:17)"
trap 'docker rm -f "$schema_test_container" >/dev/null' EXIT
for attempt in {1..60}; do
    if docker exec "$schema_test_container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
    if [[ "$attempt" = 60 ]]; then docker logs "$schema_test_container"; exit 1; fi
    sleep 1
done
for action in validate update update; do
    docker run --rm --network "container:$schema_test_container" \
        --mount "type=bind,source=$schema_test_dir/migrations,target=/changelog,readonly" \
        liquibase/liquibase:4.29.0 --search-path=/changelog --changelog-file=changelog_master.yml \
        --url=jdbc:postgresql://localhost:5432/schema_test --username=postgres --password=schema-test-only "$action"
done
docker exec -i "$schema_test_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d schema_test < "$schema_test_dir/tests/schema.sql"
echo 'PASS: fresh schema, repeated Liquibase update, and integrity checks'
