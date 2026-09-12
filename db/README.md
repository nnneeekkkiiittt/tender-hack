# Database

PostgreSQL 17, managed by Liquibase 4.29. Migrations 001–003 are a **fresh-database baseline**, rewritten with the assumption that the database is empty. They are not an upgrade path for an already migrated database; do not bypass existing Liquibase checksums.

- `001-init.sql`: accounts, claims, typed messages, operator/per-message feedback, constraints, and query indexes.
- `002-claim-history.sql`: automatic claim timestamps and before/after snapshots; immutable messages/history.
- `003-auth-sessions.sql`: hashed session tokens and automatic revocation/version increment on password changes.
- `004-unified-chat.sql`: incremental handling_level (0=AI, 1–3=support), creation request UUID, one AI answer per claim, and sequential escalation constraints. Existing claims are backfilled at L1 or their assigned operator’s level without modifying history/timestamps.

Relationships: a claim has many messages through `messages.claim_id` and at most one current operator. There is no separate conversation table. The initial question and one server-authored AI answer are persisted immediately. Handoffs update the same claim; reactions stores both AI-message feedback and final-operator feedback, distinguished by target_kind. Usernames are case-insensitively unique. All timestamps are timezone-aware. AI dislikes and user follow-ups trigger L1; assigned operators alone trigger subsequent tiers.

## FastAPI responsibilities

Migration `005-demo-accounts.sql` maps five dedicated testing identities to roles. Provisioning and password-free switching require explicit `DEMO_ACCOUNTS=true`; existing accounts are never adopted. This option grants demo admin access and must remain disabled outside a trusted local deployment.

- Authenticate every request; check session expiry, revocation, and `auth_sessions.auth_version = users.auth_version`. Store only a SHA-256 digest of a cryptographically random session token, never the token itself. Derive roles from the current account.
- Derive human identity and role from authentication. Only trusted service code may create `AI`/`SYSTEM` messages or provenance metadata.
- Enforce support roles, ownership, final-operator/DONE feedback, AI-feedback eligibility, and the six-category taxonomy. Database foreign keys do not replace authorization.
- Create a claim and initial message atomically. Before writes to an existing claim or its messages, lock the claim row and recheck state/assignment. This prevents competing assignments and messages racing with closure.
- Set transaction-local `app.actor_id` from authentication to attribute claim events; NULL represents an unknown/system actor. Update feedback `updated_at` when editing. Claim `updated_at` tracks claim edits; last-message time comes from messages.
- Keep terminal claim threads read-only. No account, claim, message, or rating deletion endpoints are in scope.

## Verification

Run `bash db/tests/run.sh` from the repository root. It validates the changelog, applies it twice, and checks integrity, history, and password revocation in an isolated PostgreSQL container. No host ports or persistent database volumes are used; the test container is removed on exit.

Migration `006-unified-reactions.sql` renames operator/reason columns to `operator_id`/`reasons`, adds validated AI-message targets, copies legacy feedback including timestamps, and removes `message_feedback` transactionally. Existing operator reaction IDs are preserved; imported AI feedback gets new reaction IDs. Invalid legacy targets abort the migration without dropping the old table. The HTTP feedback endpoints and frontend emoji controls stay compatible.

Migration `007-reaction-reasons.sql` enforces reasons for every new or updated negative reaction, including AI. A NOT VALID constraint preserves historical reason-less AI dislikes without inventing user choices; those rows must satisfy the rule if edited. Both feedback endpoints now accept `{like, reasons}` and return the same reaction shape; messages include their saved AI reaction.

Migration `008-ml-routing.sql` permits initial AI → L2/L3 only when a persisted AI message contains the matching ESCALATED decision. Human-level escalation remains sequential; no existing rows are rewritten. Citations, route and operator context use existing message JSONB metadata.
