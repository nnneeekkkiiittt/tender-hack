# User-message moderation

Pipeline: user text → moderation (CPU rules + RuBERT obscenity head) → existing AI/support workflow.
Both new claims and follow-ups at AI/L1/L2/L3 are checked before writes, locks or escalation.
Staff messages are outside this policy. Reactions do not contain a user message.

`POST /check` accepts `{ "text": "..." }` (1–10,000 characters). Internal bearer authentication uses
`MODERATION_API_KEY`; Compose falls back to `AI_API_KEY`. Do not expose this service publicly.
Response: `decision: ALLOW|BLOCK`, `reason: null|OBSCENITY`, `policy_version`, `detector`.
Backend maps BLOCK to HTTP 422 `MESSAGE_BLOCKED`, outages/busy/invalid results to HTTP 503
`MODERATION_UNAVAILABLE`. Neither persists the rejected text nor calls AI. The UI preserves the draft.
No database migration is needed. Existing request-ID retries return the existing claim.

Policy v1 blocks profanity even in quotations. General criticism and non-profane insults are not
the target. Rules use whole words, explicit exceptions, Unicode normalization, mixed-script letters,
repetition and bounded single-letter separators. Normalized text never replaces the user's original.
The project-authored lexicon is in `data/obscenity_ru.json`.

Model: https://huggingface.co/cointegrated/rubert-tiny-toxicity (MIT).
Revision and SHA256 hashes: `assets/moderation.lock.json`. Only the `obscenity` head is used;
the 0.95 threshold is an initial operating point, not a calibrated guarantee of accuracy.
Observed limitation: some obvious compound swear words score as `insult`, not `obscenity`;
explicit compound forms are therefore covered by the dictionary. The model is not a complete detector.
Texts are checked in overlapping token windows, including their tail. One inference runs at a time;
concurrent model requests return a retryable outage instead of an unbounded inference queue.
Rules can still reject explicit profanity while inference is busy. Startup warms the model.

Prepare assets from repository root:

```sh
python3 scripts/prepare-moderation.py
docker compose up -d --build moderation
```

For another model directory use `--destination PATH` and set `MODERATION_MODEL_PATH=PATH` for Compose.
`python scripts/demo.py --mock` also downloads the real 48 MB moderation model; only answering AI is mocked.
Weights are mounted read-only; runtime downloads and GPU use are disabled.

Tests: `cd moderation_service && uv sync && uv run pytest`; backend: `bash backend/tests/run.sh`.
Real weights: `MODERATION_TEST_MODEL=/absolute/model/path uv run pytest`.
Browser workflow: set `E2E_MODERATION=true`, `E2E_BASE_URL`, then run the moderation Playwright spec.
It creates a synthetic user and one claim; use an isolated environment where possible.

Before tightening policy, evaluate false positives/negatives on labelled, representative support text
(including quotations, transliteration, legal/technical terms and adversarial spellings).
The included regression cases are smoke coverage, not a production accuracy estimate.
