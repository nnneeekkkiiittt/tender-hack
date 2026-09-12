# Local ML prototype — 2026-09-12

Running app: http://localhost:8080. Real ML is enabled (`AI_MODE=http`), not mock AI.
Use the existing **Демо** menu for Consumer/Admin/L1/L2/L3 accounts.

## What was integrated

- `ml-core` at `1ef2490`, selectively imported without replacing the frontend,
  operational schema, or existing worktree changes.
- Same architecture: intent routing → multi-query retrieval/rank fusion →
  grounded generation → operator context card.
- CPU-local Qwen3-4B Q4_K_M through llama.cpp, E5 through TEI, Qdrant.
  Existing local model files were reused; no new model weights were required.
- Six manuals / 830 pages / 1,276 existing E5 chunks. Source SHA-256 hashes
  verified before import; source PDFs and generated source index unchanged.
  Historical ticket answers and handoff notes are not indexed as answer evidence.
- Exact leaf-heading preference, edition metadata, full page ranges, stable
  citation numbering, and concise answers distinguish personal/admin procedures.
- AI decisions can route directly to L1/L2/L3. User dislike/follow-up still
  reaches L1 if AI retains the claim. At human tiers, only support escalates.
- One persistent chat and the same reaction form/validation remain in place.
  Staff receive the persisted ML context; customers see answer/source references.
- ML transport, retrieval and generation failures do not masquerade as successful
  resolutions. Insufficient generated evidence can also request a handoff.

## Verification

- 35 backend tests; migration validation, repeated updates, and integrity checks.
- ML unit/contract/import tests, including changed-source rejection, error
  handling, section matching, page ranges and citation numbering.
- Six browser regressions passed using an isolated mock-AI database.
- Opt-in real-model browser test passed: actual manual answer → like → dislike
  with reasons → L1 → staff escalation to L2; separate error-500 claim → L3;
  later dislike/follow-up does not skip or reverse human tiers.
- Real off-topic question returned a refusal without a transfer.
- Warm end-to-end manual answer: 33 seconds. Automatic incident: 7 seconds.
  Earlier cold/manual checks took roughly 2–3 minutes on this CPU.
- Existing records were fingerprinted before/after migration and deployment;
  all original users, claims, messages, reactions and audit records were preserved.

Prototype test artifacts remain identifiable: claims #7 and #8 contain manual
answers; #8 was handed off to L2; #9 is a technical incident queued at L3.
Two `ml-prototype-*` users were created by the real browser checks. The separate
regression-test database and containers were removed, not the live database.

Backup before migration: `/tmp/tender-before-ml-453sAG/database.dump`.
Startup and test instructions: [ml_service/README.md](ml_service/README.md).
No commits, pushes, or branch switches were made.

## Prototype limits

This is not a production-quality accuracy claim. The inherited benchmark uses
autonomous labels and previously showed weak retrieval recall; the small live
checks do not replace a representative, independently reviewed evaluation.
The threshold and heading/edition ranking adjustments remain heuristics.

CPU inference is slow on cold/new contexts and intended for low concurrency.
Initial generation is synchronous and holds the claim-creation transaction;
background jobs/streaming and load testing are the next production steps.
The demo account switcher grants privileged access and must remain local-only.
