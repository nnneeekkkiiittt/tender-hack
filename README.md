# Tender operational support

FastAPI + PostgreSQL/Liquibase + React. Implements username accounts, cookie sessions, support queues, claim conversations, assignment/reassignment, resolution/cancellation, and operator feedback. Statistics and the AI engine are separate services.

## One-command reproducible demo

Requirements: Git, Python 3.10+, Docker with Compose v2, and internet access on
first startup. Real ML is CPU-only; allow about 8 GB free RAM (16 GB recommended),
10 GB free disk, and several minutes for downloads/builds and the first answer.

```sh
git clone <this-repository-url> tender-hack
cd tender-hack
./scripts/demo-up.sh
```

Open **http://localhost:8080** and use **Демо → Admin / L1 / L2 / L3 / Consumer**.
PostgreSQL, migrations, five demo identities, five labelled sample claims (AI,
L1, L2, L3, resolved with feedback), models and manual index are set up automatically.
Create a **new question** to test real inference: sample messages are fixtures,
not model outputs. No accounts or live database need to be copied from a server.

For an operational demo without answering-model downloads: `./scripts/demo-up.sh --mock`.
Only answering AI is mocked and explicitly labelled; moderation still downloads its 48 MB CPU model.
The database and permissions are real.
Running without `--mock` selects real ML again. There is no silent mock fallback.

The launcher creates `.demo/config.env` with random credentials (0600), extracts
the versioned manual bundle, downloads checksum-pinned model files into `.demo/models`,
imports 1,276 manual chunks, and waits for readiness. Subsequent runs preserve
credentials, accounts, edited claims and persistent Docker volumes. The normal
developer `.env` and existing deployments are not used. Do not commit `.demo/`.

For another set of ports, on the first run:

```sh
./scripts/demo-up.sh --port 18080 --api-port 18000 --db-port 15433
```

Later runs reuse saved ports. Use `--state-dir /absolute/path --project another-demo`
for a separate installation; each installation needs a unique Compose project and ports.
`--model-cache /path` optionally reuses verified files arranged as `e5/` and `qwen/`.

The analytics service from upstream main is retained under the optional
`analytics` Compose profile (loopback port 8081). Its raw-data queries support
the current schema, including nullable operators on AI reactions. It is not
connected to the frontend statistics screens and has no public authentication;
do not expose it externally.

The demo launcher binds all published ports to loopback. Direct Compose startup publishes the frontend
on port 80; set `WEB_BIND=127.0.0.1` for localhost-only access. Password-free demo switching
grants administrator access; exposing it is an explicit operator decision, not
a production-safe configuration. The public server's settings and passwords are
not part of this repository. Statistics remain a separate optional service.

Assets, reproducibility and licenses: [assets/README.md](assets/README.md).
Fresh-clone browser acceptance (install Chromium first):

```sh
E2E_DEMO=true E2E_REAL_ML=true E2E_BASE_URL=http://localhost:8080 \
  npm --prefix frontend run test:e2e -- demo.spec.ts
```

Omit `E2E_REAL_ML=true` when testing `--mock`. If running browser suites in
parallel, give each a separate `--output` directory to avoid trace-file collisions.

## Manual developer setup

1. Create `.env` from `.env.example` and set a strong `BOOTSTRAP_ADMIN_PASSWORD` (at least 10 characters).
2. Run `python3 scripts/prepare-moderation.py`, then `docker compose up --build -d`.
3. Open [the application](http://localhost). Register a user, or sign in with your bootstrap administrator to create support accounts. Set `ALLOWED_ORIGINS=http://localhost` (or the actual public origin) in `.env`.

The API and interactive contract are at [localhost:8000/docs](http://localhost:8000/docs). Liquibase runs before the backend starts. The bootstrap account is created only when no administrator exists; changing bootstrap environment variables does not reset existing passwords.

**Schema:** migrations 001–003 are the rewritten fresh baseline. Migration 004 upgrades that baseline in place to unified chat; do not reset existing local data. Do not bypass Liquibase checksums on a previously migrated database. PostgreSQL data persists in the Compose volume.

This Compose configuration is for a local demo: ports bind to loopback and the database uses development credentials. A hosted deployment needs real database credentials, TLS, `COOKIE_SECURE=true`, an exact `ALLOWED_ORIGINS` list, and proxy-level rate limiting. The built-in authentication limiter is per process/IP; it is not a distributed abuse-prevention service.

## Features and contract

- Roles: `user`, `admin`, `supportL1`, `supportL2`, `supportL3`; each support level handles its own queue; only assigned operators can escalate to the next tier.
- A user's claims are private to that user and staff. Only the assigned operator/admin can perform staff writes; the first operator reply can atomically take an unassigned claim.
- Lifecycle: `NEW → IN WORK → DONE`; the author may cancel an active claim. Terminal claims remain readable and cannot be reopened or messaged.
- Only the author can rate the final operator after `DONE`. Negative ratings require one or more reason codes; a rating is editable.
- Immutable messages and claim history are stored in PostgreSQL. One claim is one chat, linked by messages.claim_id; there are no conversation IDs. API IDs are strings in responses; mutation bodies accept the numeric ID or its decimal string.
- List endpoints return `{items, total, offset, limit}`. Message history returns `{items, next_before}` and supports `before_id`. Open views refresh every five seconds.
- Browser mutations require `X-Requested-With: tender` and an allowed origin. Sessions use HttpOnly cookies. Password changes/resets revoke all existing sessions; logout revokes the current session.
- No priorities, attachments, organization/email profiles, account deactivation, statistics UI, or unlabelled mock AI results.

See [the feature spec](FEATURE_SPEC.md) and [database notes](db/README.md). OpenAPI is the executable API contract.

## AI integration

All user questions and follow-ups first pass through the separate CPU moderation service.
Blocked messages return `MESSAGE_BLOCKED` without writes, AI calls or escalation; the draft remains
editable. Service failures return retryable `MODERATION_UNAVAILABLE`, not an accusation of profanity.
Policy, model limitations, contracts and tests: [moderation_service/README.md](moderation_service/README.md).

The local ML setup is documented in [ml_service/README.md](ml_service/README.md). Set `AI_URL` to the exact upstream POST endpoint. The backend sends `{"question":"..."}` and expects `{"answer":"...","sources":["..."]}`. `AI_API_KEY`, if set, is sent as a Bearer token server-side and never exposed to the browser. The local CPU profile allows up to 420 seconds (AI_TIMEOUT); no mock response is substituted on failure.

One chat follows AI → L1 → L2 → L3. The initial question creates a claim and stores one AI answer. An ML escalation decision sends the same chat directly to L1/L2/L3. Otherwise, a dislike or any user follow-up sends it to L1. Only the assigned operator can escalate L1/L2 to the next tier; L3 is final. All messages remain in the same history. If AI is unavailable, the question and a system notice persist; a follow-up still reaches L1.

For local AI mocking, set `AI_MODE=mock` in `.env` and recreate the backend with `docker compose up --build -d --no-deps backend`. Only AI is mocked: accounts, sessions, claims, and feedback stay real. `MockAiService` returns a deterministic answer explicitly labelled **Mock AI**, with no invented sources, or network requests. Its one answer is persisted like a real AI response. Switch back with `AI_MODE=http` and configure `AI_URL`/`AI_API_KEY`. HTTP mode never silently falls back to mock. Both classes implement `AiService.ask(question) -> AiAnswer` in `backend/app/ai.py`; the implementation can also be injected into `create_app` for tests.

## Development

With PostgreSQL and Liquibase running, use `uv sync --project backend`. Then, from `backend/`, run `uv run uvicorn app.main:app --reload`. `DATABASE_URL` defaults to the local Compose database on port 5433.

For a backend running outside Docker, also run moderation locally: from `moderation_service/`, use
`MODERATION_MODEL_PATH=../.demo/models/moderation uv run uvicorn app.main:app --host 127.0.0.1 --port 8003`.
Set the backend's `MODERATION_URL=http://127.0.0.1:8003/check` and matching `MODERATION_API_KEY`
for both processes. The Compose-only hostname `moderation` is not resolvable from the host.

From `frontend/`, run `npm ci --registry=https://registry.npmjs.org` and `npm run dev`. Vite proxies `/api` to localhost:8000. API mode is the default. Set `VITE_APP_MODE=demo` only to view the explicitly labelled legacy mock UI. Both Python and npm dependencies are locked; after changing Python dependencies, regenerate Docker requirements with `uv export --project backend --no-dev --format requirements-txt --output-file backend/requirements.txt`.

Administrative recovery prompts for a new password without putting it in shell arguments:

```sh
docker compose exec backend python -m app.admin administrator --reset-password
```

Omit `--reset-password` to provision a new administrator explicitly.

## Tests

```sh
bash db/tests/run.sh
bash backend/tests/run.sh
cd frontend
npm run lint
npm run build
npx playwright install chromium
E2E_ADMIN_PASSWORD='your-test-admin-password' npm run test:e2e
```

Database/API tests create and clean up isolated PostgreSQL containers. Browser tests require a running **test** deployment and create test users, staff, claims, and feedback; set `E2E_BASE_URL`/`E2E_ADMIN_USERNAME` if needed. Do not point them at real user data. The browser scenario covers registration, first reply, reassignment, resolution, feedback persistence, password change, and administrator password recovery.

Run the browser suite with `AI_MODE=mock` on an isolated test deployment. It covers both AI handoff triggers and the full L1 → L2 → L3 workflow. Backend tests cover AI failure, authorization, concurrent handoffs, idempotent creation, and migration upgrades.

## Local test account menu

Set `DEMO_ACCOUNTS=true` and recreate the backend to enable the top-menu **Демо** switcher (also on login). It provisions separate persistent Admin, L1, L2, L3, and Consumer accounts; switching uses real cookie sessions and backend permissions. Existing accounts are never reused or overwritten. All demo accounts share the same operational database. **Anyone who can reach this deployment can become demo admin: never enable this on a public or production deployment.** Disabled by default; disabling and restarting revokes demo-account sessions. This is distinct from the legacy frontend mock mode.

AI and operator feedback share one 👍/👎 form and `{like, reasons}` API contract. Both require at least one of the same four reasons for a dislike and allow edits while eligible. AI dislikes transfer an AI-level claim to L1 only when submitted; likes and operator ratings do not escalate.
