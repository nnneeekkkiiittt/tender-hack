# Public prototype operations — 2026-09-13

Application: http://111.88.153.146. Repository: `/home/dev/tender-prototype`
(the old `app/` subdirectory is no longer used). Compose project: `tender-prototype`.
Private `.env` selects `docker-compose.yml:compose.deploy.yml` and the `ml` profile.
Preserve these files and existing data volumes.

## Updating the existing server

```sh
ssh dev@111.88.153.146
cd /home/dev/tender-prototype
git status --short
git pull --ff-only origin main
docker compose config -q
docker compose up -d --build
docker compose ps
docker compose logs --tail=50 backend ml tei llm-qwen25 analytics metabase
```

Stop if Git reports unexpected changes; do not reset them or deploy a second
checkout under another Compose project. Never use `down -v` for routine deployment.
Backend startup waits for migrations and moderation. `metabase-db` idempotently
creates Metabase's own database. Model startup can take minutes; running is not
the same as ready. Check:

```sh
curl --fail http://127.0.0.1:8000/health/ready
docker compose exec -T ml .venv/bin/python -c 'import requests; r=requests.get("http://localhost:8001/health/ready", timeout=10); print(r.text); r.raise_for_status()'
curl --fail http://127.0.0.1:3000/api/health
nvidia-smi
```

## Runtime and data

- PostgreSQL 16: active volume `tender-prototype_tenderhack_postgres_data`.
  Do not substitute the older inactive `tender-prototype_postgres_data` volume.
- GPU inference: **Qwen/Qwen2.5-7B-Instruct-AWQ**, vLLM, NVIDIA **L4**,
  context 8,192. The server override disables the obsolete llama.cpp service.
- Embeddings: **BAAI/bge-m3**, 1,024 dimensions, CPU TEI (immutable image digest),
  persistent `tei_data` cache. Qdrant collection: **kb_support**.
- Knowledge: six manuals, 1,276 chunks; source files under `knowledge/`, models
  under `models/`. Old E5 vectors are 384-dimensional, not compatible with BGE.
- Pipeline: router → retrieval/reranking → generation/context card. Automatic
  routing and user-triggered escalation both remain. Moderation is a separate
  CPU RuBERT/lexicon service, called before user-message writes.
- Metabase: `metabase_app` DB; read-only `tender_metabase` role for operational
  data. Recovery credentials in `.metabase-bootstrap.json` (0600, ignored by Git).
  Analytics uses internal `METABASE_URL=http://metabase:3000` and browser-facing
  `METABASE_PUBLIC_URL=http://111.88.153.146:3000`.

If the vector collection is missing, wait for TEI and run once:

```sh
docker compose exec -T ml .venv/bin/python import_index.py --root /knowledge --collection kb_support
```

CPU re-indexing takes minutes. Do not restart ML/TEI while it runs. Normal
application deploys do not require re-indexing. Incompatible dimensions now fail
explicitly rather than deleting a collection.

The GPU override and private model/configuration assets are not supplied by
`git pull`: these are update instructions for the existing server, not a claim
that a fresh machine works after cloning alone.

## Accounts, ports and limitations

Consumers register normally. Admins create L1/L2/L3 accounts under Employees;
those accounts use normal username/password login. The demo chooser uses real
backend accounts and the same ML pipeline, not a lighter model.

Password-free demo Admin/L1/L2/L3/Consumer switching remains enabled at the user's
explicit request. Anyone with the URL can choose Admin. **Synthetic data only;
this is not production-secure.**

Analytics port 8080 is loopback-only. Browser requests pass through the backend's
admin-session and CSRF checks. Metabase port 3000 requires login except for signed,
expiring chart embeds. PostgreSQL 5433 remains public at the user's request;
credentials stay in `.env`. Website and DB connections have no TLS. Disable demo
accounts, restrict DB access and configure HTTPS before production use.

Profile/email-notification settings are not implemented; API-mode controls are
disabled. Attachments and support statistics remain unavailable. Passing a demo
workflow does not establish production load capacity or broad ML accuracy.

## Tests

```sh
bash backend/tests/run.sh
ml_service/.venv/bin/pytest -q ml_service/tests
MODERATION_TEST_MODEL=/path/to/moderation moderation_service/.venv/bin/pytest -q moderation_service/tests
cd frontend
npm run build
npm run lint
E2E_BASE_URL=http://111.88.153.146 E2E_DEPLOYMENT=true E2E_REAL_ML=true E2E_MODERATION=true \
  npx playwright test e2e/deployment.spec.ts e2e/real-ml.spec.ts e2e/moderation.spec.ts --reporter=line
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` for an existing Chromium installation.
Backend tests create an isolated database. Public browser tests create synthetic
users/staff/claims without resetting existing data. Do not run fresh-seed or mock
workflow tests against the public database expecting their isolated fixtures.

Before the 2026-09-13 repair, all databases and private config were backed up to
`/home/dev/tender-backup.4xclzxuU` (restricted permissions).
