# Local ML prototype

Adapted from `origin/ml-core` at `1ef2490`. The original facade and stages remain:
`SupportMLPipeline → IntentRouter → KBRetriever → AnswerGenerator → ContextCard`.

The CPU profile uses Qwen3-4B Q4_K_M and multilingual-E5-small. The reproducible
launcher downloads the pinned official Qwen quantization and exact E5 weights;
it does not fine-tune. Run `./scripts/demo-up.sh` from the repository root.
Qwen is served by llama.cpp through the same chat-completions interface; E5 is
served by TEI; Qdrant stores the existing 384-dimensional vectors. Query strings
have the required `query: ` prefix. Do not mix these vectors with BGE-M3's 1024 dimensions.

## Knowledge

Six manuals, 830 pages, 1,276 chunks from `tenderhackmaterials/dense_kb_v1`.
The importer checks the six source PDF hashes, vector shape, normalization and
counts before writing. It uses stable point IDs and never drops a collection.
The source directory is mounted read-only. Historical ticket resolutions and
the handoff document are not answer evidence.

Retrieval preserves multi-query search and rank fusion, with a small exact
leaf-section boost so a matching parent heading does not confuse personal and
administrator workflows. Explicit edition strings are read from indexed title
pages and retained alongside full page ranges. Near-tied versioned manuals are
preferred to undated overlap; these are prototype heuristics, not a new quality
guarantee. The generator can return `[NO_CONTEXT]` when retrieved passages cannot
answer the question; the pipeline then requests an actual backend handoff.

Default paths in Compose point into ignored `.demo/`. Set `MANUALS_PATH`,
`E5_MODEL_PATH`, and `QWEN_MODEL_PATH` in `.env` on another machine.

## Start

From the repository root:

```sh
docker compose --profile ml up -d --build qdrant tei llm ml
docker compose --profile ml exec -T ml .venv/bin/python import_index.py
docker compose --profile ml exec -T ml .venv/bin/python -c \
  "import urllib.request; print(urllib.request.urlopen('http://localhost:8001/health/ready').read().decode())"
```

After readiness succeeds, set `AI_MODE=http`, `AI_URL=http://ml:8001/ask`,
`AI_TIMEOUT=420`, `MODEL_NAME=local-qwen`, and `VLLM_BASE_URL=http://llm:8002/v1`
in `.env`, then `docker compose --profile ml up -d --build backend frontend`.
For mock mode, set `AI_MODE=mock` and recreate only the backend.

All ML ports are internal to the Compose network. `AI_API_KEY` optionally
protects `/ask` and is shared server-side, never sent to the browser.
No ML service has operational PostgreSQL credentials.

## Contract and ownership

`POST /ask` accepts `{"question":"..."}`. Returns `answer`, `sources` (display
references), `status`, `route`, structured `citations`, and `context_card`.
`GET /health/live` checks the wrapper; `/health/ready` checks the model, TEI,
and a populated Qdrant collection.

Only the backend mutates claims. `ESCALATED` routes an initial AI claim directly
to the returned L1/L2/L3 queue in the same transaction that stores the reply.
Other ML outcomes do not close the claim. The user's dislike (with reasons) or
follow-up still reaches L1 when the claim is at AI. After a human handoff, these
actions do not change levels; assigned support escalates sequentially.

Infrastructure errors produce HTTP 503, not `AUTO_RESOLVED`. The backend saves
the user's question plus its availability notice; a follow-up can reach L1.
Classification retains ml-core's heuristic fallback if the router fails.

## Tests and limits

```sh
cd ml_service
uv run pytest -q
uv run ruff check app tests import_index.py
```

Operational tests: `bash backend/tests/run.sh` from the repository root.
An opt-in real-model browser test creates identifiable prototype accounts/claims:
`E2E_REAL_ML=true npm --prefix frontend run test:e2e -- real-ml.spec.ts`.
Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if Chromium is installed outside Playwright's default path.
CPU inference is for low-concurrency demonstrations, not production throughput.
Initial generation is synchronous; the UI waits, and the backend database
transaction remains open until the answer/error is persisted. A queued background
generation job is the next reliability improvement for production.

The E5 threshold is a prototype heuristic, not a calibrated confidence guarantee.
The handoff's retrieval benchmark used autonomous labels and reported weak recall;
passing integration tests does not establish broad answer accuracy. Keep manual
citations visible and retain human escalation. The legacy `preprocessing.py`
remains available for the original BGE pipeline, but do not use it against the
E5 collection: rebuild an E5 index and import into a fresh collection instead.
