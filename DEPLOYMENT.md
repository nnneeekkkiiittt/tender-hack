# Public prototype — 2026-09-12

URL: http://111.88.153.146

SSH: `ssh -l dev 111.88.153.146`

App: `/home/dev/tender-prototype/app`; Compose project: `tender-prototype`.
Post-deployment change requested by the user: PostgreSQL is now public on
`111.88.153.146:5433` (database `tender-hack`, user `postgres`). Password remains
in the server-only `.env`. SCRAM authentication is enabled; database TLS is off.
This is privileged access over an unencrypted connection, for demo use only.
The server-only `.env` selects `docker-compose.yml:compose.deploy.yml`, enables
the real ML profile, and contains freshly generated credentials (mode 0600).
No existing local credentials, operational database, or historical tickets were copied.

## Accounts

Admin username: `admin`. Support usernames: `support-l1`, `support-l2`, `support-l3`.
Passwords are in `/home/dev/tender-prototype/accounts.json` on the server (0600).
Read them over SSH; do not commit this file. Public demo account switching is enabled
at the user's explicit request. Anyone with the URL can use demo Admin, L1, L2,
L3, and Consumer accounts without a password; do not put sensitive data here.
Consumers can register normally: username without spaces, password 10–128 characters.

## Operations

Run on the server:

```sh
cd /home/dev/tender-prototype/app
sudo docker compose ps
sudo docker compose logs --tail=100 backend ml llm
sudo docker compose up -d --build
```

Docker starts at boot; long-running services have restart policies. PostgreSQL
and Qdrant use named volumes. Do not run `down -v` unless intentionally deleting data.
Model files are under `/home/dev/tender-prototype/models`; manuals and the original
E5 index are under `/home/dev/tender-prototype/knowledge`.

The imported `manuals_e5_v1` collection has 1,276 chunks from six SHA256-verified
manuals. Architecture remains router → retrieval → generation/context card,
with Qwen3-4B Q4 on CPU, E5 through TEI, and Qdrant.

## Verified from outside the server

Real Playwright/Chromium browser checks against the public IP passed:

- Login page and its original images; public registration and mobile layout.
- Real manual answer with page/edition citations (first request: 122.267 seconds).
- Like stays at AI; dislike requires a reason and transfers to L1.
- Support UI login, assignment, and escalation L1 → L2 → L3.
- Automatic incident routing directly to L3; admin employee list.
- No user-page JavaScript errors after fixing HTTP UUID generation.
- Public port 80 reachable; 5433, 6333, 8000, 8001, 8002 inaccessible externally.

Browser scripts/screenshots are on the deployment workstation under
`/tmp/tender-public-*`; test accounts and two synthetic claims were retained.
The initial failed browser attempt found that `crypto.randomUUID()` is unavailable
on public HTTP. The frontend now generates UUIDv4 with `crypto.getRandomValues()`;
request ID generation is inside the existing error-handling block. The regression
workflow now simulates missing `randomUUID`. Frontend lint and server build passed.

## Limits

HTTP only: no TLS certificate/domain configured. Use test data, not sensitive
information; HTTPS is required before production use. CPU inference can take
minutes and is configured for one concurrent model slot. This deployment verifies
the prototype workflow, not production load capacity or broad answer accuracy.
