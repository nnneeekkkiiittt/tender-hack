#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --set=db_name="$METABASE_APP_DB_NAME" <<'SQL'
SELECT format('CREATE DATABASE %I', :'db_name')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db_name')
\gexec
SQL
