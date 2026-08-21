# Memora execution plan

Written 20 Aug 2026, after the competitive read against mem0. The finding that drives
this plan: mem0 rebuilt its algorithm in April 2026 and deleted the write-time
reconciliation step Memora is built on — single-pass ADD-only extraction, conflicts
resolved at read time, roughly half the extraction latency, +29.6 on temporal queries.

Our answer is not to drop reconciliation. It is to **separate storage from judgement**:
write append-only, reconcile asynchronously. Same audit trail, a fraction of the cost.

**Sequencing principle: numbers before changes.** Phase 0 exists so every later phase can
be proven rather than argued. Nothing in Phase 1+ ships without a before/after score.

---

## Status — 20 Aug 2026

Phases 0 and 1 are built, and 2.1–2.2 with them. What the first eval run turned up is
recorded under each item.

| Item | State |
|---|---|
| 0.1 Test infrastructure | Done — 43 tests, no network, `pnpm test` |
| 0.2 Eval harness | Done — `pnpm eval`, golden dataset, results in `evals/results/` |
| 0.3 CI | Done — `.github/workflows/ci.yml`, nightly `eval.yml` |
| 1.1 Batch embeddings | Done — one Voyage request per `remember()` |
| 1.2 Job queue | Done — `reconciliation_jobs` |
| 1.3 Append-only `remember()` | Done |
| 1.4 `reconcile()` | Done — `src/lib/reconcile.ts` |
| 1.5 Draining | Done — `after()` in the route, `pnpm reconcile` worker |
| 1.6 Read-time collapse | Done — `collapseDuplicates` in `src/lib/scoring.ts` |
| 1.7 Reconciliation state | Done — `explain`, table chip, detail page |
| 2.1 Hybrid retrieval | Done — `content_tsv` + GIN, RRF fusion |
| 2.2 Recall filters | Done — `type`, `min_confidence`, `since`, `until` |
| 2.3 Wider scoping keys | Done — `agent_id`, `session_id` on write, read and filter |
| 3.1 TypeScript SDK | Done — `packages/sdk` (`@memora/client`), 11 tests |
| 3.2 MCP server | Done — `packages/mcp` (`@memora/mcp`) |
| 3.3 Python SDK | Not started |
| 3.4 Docs / repositioning | Partly — quickstart, deploy runbook, package READMEs, eval guide |
| 4.1 Request guards | Done — key scopes, per-key rate limits, monthly quotas, idempotency keys |
| 4.2 Deployability | Done — Dockerfile (boot-verified), production compose, migrate-then-start, health check |
| 4.3 Publish pipeline | Done — MIT licences, npm metadata, manual release workflow with provenance |
| 4.4 Billing | Not started — metering exists, nothing charges |
| 4.5 Team accounts, PII, audit log | Not started |

### What the numbers said

First golden run (`claude-sonnet-5` pipeline, `claude-opus-5` judge): **78.6% accuracy**
— 100% on abstain, exact-string and multi-hop; 75% single-hop; 67% temporal; **0% on
contradiction**. Cost landed at **$5.60 per 1,000 memories**, which is the number pricing
should be argued from.

Wall-clock latency is not yet measurable: the Voyage account has no payment method and is
capped at **3 requests per minute**, so every write and read in the run is dominated by
rate-limit waiting. `VOYAGE_MAX_RPM` paces requests so a run completes at all. Adding a
payment method is the prerequisite for any latency claim — and for the product working at
all beyond a demo.

### Guards, deployability and publishing (20 Aug, afternoon)

Everything on the "hard blockers" list that does not need an account someone
has to pay for:

- **Key scopes.** `read` and `write` on `api_keys`; every route declares which
  it needs. A read-only key writing gets 403.
- **Rate limits.** Fixed window per key per minute, counted in Postgres so the
  limit stays correct across instances — an in-memory counter multiplies every
  limit by the number of servers. Responses carry `RateLimit-*`; a 429 carries
  `Retry-After`, and the SDK honours it instead of guessing.
- **Monthly quotas.** Writes and reads per calendar month from `api_requests`,
  refused with **402** rather than 429, because waiting does not fix a spent
  quota. Plan ceilings live in `src/lib/plans.ts` — a reviewed diff, not an
  UPDATE at 2am.
- **Idempotency keys.** A repeated write replays the original response; the same
  key with a different body is a 409 rather than a plausible-looking success.
- **Deployable.** Multi-stage Dockerfile (~290 MB, non-root, standalone output,
  migrations in the image), a production compose that runs migrations to
  completion before the app starts, and a real health check that fails when the
  database is unreachable.
- **Publishable.** MIT licences, npm metadata, and a manual release workflow
  with provenance. `npm pack` produces a clean five-file tarball for both
  packages.

Two bugs surfaced doing it, both of which only appear outside a dev machine:

- **The image would not boot.** Next's standalone trace misses transitive
  dependencies reached through pnpm's symlinks; `@swc/helpers` failed at
  runtime, not at build. The image now installs hoisted. This is the kind of
  thing that is discovered during a first deploy at the worst possible moment.
- **The app build depended on the packages.** `pnpm build` type-checked
  `packages/mcp`, which resolved locally only because the SDK happened to be
  built. In a clean checkout it fails. They are separate build units now, and
  CI checks them separately.

Verified by `pnpm smoke`: 17 of 17 through the real HTTP surface, including
scope enforcement, rate-limit headers, idempotent replay and replay conflict.

### Four bugs the eval found

1. **Same-batch siblings were never compared.** Reconciliation selected neighbours with
   `created_at <= this.created_at`. Every row in one insert shares a microsecond-precision
   timestamp, and the JS `Date` carrying it back truncates to milliseconds — so the
   comparison excluded every sibling and two facts extracted from one sentence were never
   merged, versioned or flagged against each other. Only 12 decisions ran for 28 memories.
   Now: strictly older rows, plus siblings already reconciled.
2. **Tool calls could be truncated.** Both the engine and the harness capped `max_tokens`
   at 1024–2048, but current models think by default and thinking draws on that budget. A
   grade came back empty and the harness scored a correct answer as wrong. Raised to 8192,
   and a malformed verdict now throws instead of silently counting as a failure.
3. **"90-day half-life" was never a half-life.** `exp(-age/90d)` reaches 0.37 at 90 days,
   not 0.5; the true half-life is ~62 days. Renamed rather than re-tuned — changing the
   curve needs an eval to justify.
4. **Contradiction detection cannot fire on what extraction discards.** In the golden
   allergy case, "had a peanut butter sandwich" extracts to nothing, so the peanut allergy
   is never contradicted. The flagship differentiator is bounded by the extraction prompt,
   not by the decision prompt. This is the first thing to fix in reliability work.

---

## Phase 0 — Proof (≈1 week)

There are currently zero test files in this repo and no benchmark numbers. Both block
everything else.

### 0.1 Test infrastructure

- Add `vitest`, `vitest.config.ts`, `"test": "vitest run"` to `package.json`.
- Extract the recall scoring maths out of `recall()` in `src/lib/memory-engine.ts` into a
  pure `scoreMemory({ similarity, confidence, lastConfirmedAt, now })` so it is testable
  without a database.
- First tests: scoring weights (0.60/0.25/0.15), the 90-day freshness decay, the
  experience weights (0.75/0.25), `hashApiKey`, every route's zod body schema, and the
  401 path in `withApiKey`.

**Done when:** `pnpm test` runs green in under ten seconds with no network access.

### 0.2 Eval harness

New `evals/` directory:

- `evals/datasets/` — loader for LoCoMo and a LongMemEval subset.
- `evals/run.ts` — provisions a throwaway org/project/environment and key directly
  through Drizzle, replays each conversation through `remember()`, then asks each
  question through `recall()`, answers with Claude from the retrieved memories only, and
  judges against the gold answer.
- Per question, record: correct/incorrect, write latency, read latency, tokens and cost
  (join `usage_events` — the metering is already there), and the dataset's own category
  so we can compare like-for-like with mem0's published splits (single-hop, multi-hop,
  temporal, open-domain).
- `evals/report.ts` — writes `evals/baselines/<date>.json` plus a markdown table.
- Make the model an eval dimension: Sonnet 5 vs Haiku 4.5 for extraction and decisioning.
  Our cost problem may be a model-choice problem.

**Done when:** `pnpm eval` prints accuracy by category, p50/p95 latency, tokens per
recall and dollars per 1,000 memories, and a baseline is committed.

### 0.3 CI

GitHub Actions: lint, `tsc --noEmit`, unit tests on every PR. Eval runs nightly (it costs
real money) and posts its scoreboard.

**Done when:** a PR cannot merge red.

---

## Phase 1 — Split the write path (≈2 weeks)

Today `remember()` does `1 + 2N` sequential calls: one Sonnet extraction, then per
candidate an embed and a Sonnet decision. Target: one extraction call, one batched embed
call, an immediate return, and reconciliation afterwards.

### 1.1 Batch embeddings

`src/lib/voyage.ts` — add `embedDocuments(texts: string[])`. The Voyage `input` field
already accepts an array; this is a small change that removes N-1 round trips.

**Done when:** one `remember` call makes exactly one Voyage request regardless of how
many candidates were extracted.

### 1.2 Durable job queue

New `reconciliation_jobs` table: `id`, `memory_id`, `project_id`, `environment_id`,
`end_user_id`, `status` (`pending|running|done|failed`), `attempts`, `last_error`,
timestamps, indexed on `(status, created_at)`. A durable table rather than an in-memory
queue because the audit trail is the product — a lost job is a lost explanation.

Migration via `pnpm drizzle-kit generate`.

### 1.3 Rewrite `remember()`

Extract → batch embed → insert every candidate as `active` with `extracted` evidence →
enqueue one job per memory → return. Response gains a `reconciliation: "pending"` field
per outcome (additive, so no client breaks).

### 1.4 New `src/lib/reconcile.ts`

`reconcile(memoryId)` loads the memory and its nearest neighbours (excluding itself),
calls the existing `decideMemoryAction`, and then *repairs* rather than *prevents*:

| Decision | Before (write-time) | After (reconcile) |
|---|---|---|
| `ADD` | insert | no-op, already inserted |
| `UPDATE` | insert new, supersede old | link the new row to the old via `supersedesId`, mark old `superseded` |
| `MERGE` | write merged content | rewrite the new row's content, supersede the old |
| `IGNORE` | skip insert, reconfirm | delete the row just written, bump `lastConfirmedAt` on the existing one, write `reconfirmed` evidence |
| `FLAG` | insert + contradiction row | insert contradiction row, set both `flagged` |

Evidence rows and Claude's reasoning are written exactly as they are today.

### 1.5 Draining

- `after()` from `next/server` (stable in Next 16 — see
  `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`) in the
  remember route drains that scope's pending jobs once the response is sent.
- `scripts/reconcile-worker.ts` — a loop claiming jobs with
  `SELECT … FOR UPDATE SKIP LOCKED` for retries and backlog. Add it to
  `docker-compose.yml` later.
- Retry with backoff, `failed` after 3 attempts, surfaced in the dashboard.

### 1.6 Read-time safety

Between the write and its reconciliation, `recall()` can return a fact and its stale
twin. Collapse results by supersedes-root, and drop near-duplicates above ~0.97 cosine,
keeping the newest and most confident. This is the mem0 model anyway — read-time
resolution — and it is what makes the async window safe.

### 1.7 Surface the state

Add `reconciled_at` to `memories`. Dashboard shows a "reconciling" chip; `explain`
reports pending status.

**Done when:** p95 `remember` for a three-fact input drops from seconds to under ~1.5s,
eval accuracy is at or above the Phase 0 baseline, and the worker leaves no orphan jobs.

---

## Phase 2 — Retrieval quality (≈1 week)

`recall()` is vector-only and takes nothing but a query and `top_k`.

### 2.1 Hybrid retrieval

Generated `tsvector` column on `memories.content` with a GIN index. Fuse the vector rank
and the full-text rank with reciprocal rank fusion (k=60), then apply the existing
weighted rescoring to the fused candidate set. Postgres gives us this for free; it is
most of mem0's multi-signal gain without entity extraction.

**Done when:** eval cases containing exact strings — names, ids, product codes — that
pure vector search misses now return the right row.

### 2.2 Filters on recall

`type[]`, `min_confidence`, `since`/`until`, and metadata matching. Extend the zod schema
in `src/app/api/v1/memories/recall/route.ts` and the engine together.

### 2.3 Wider scoping keys

Nullable `agent_id` and `session_id` on `memories`, indexed, accepted by remember and
filterable on recall and list. Without these, multi-agent products cannot tell whose
memory is whose — and that is exactly the audience Experience Memory is for.

**Done when:** re-running the eval beats the Phase 1 numbers on the temporal and
multi-hop splits.

---

## Phase 3 — Distribution (≈2 weeks)

mem0 is `pip install mem0ai` and four lines. We are a curl command.

### 3.1 TypeScript SDK

`packages/sdk` → `@memora/client` (the pnpm workspace already exists). Typed methods for
all seven `/api/v1` routes, retries, typed errors. Publish to npm.

### 3.2 Python SDK

Minimal mirror of the same surface.

### 3.3 MCP server

`packages/mcp` exposing `remember`, `recall` and `record_experience` so Claude Code and
Cursor write to Memora directly. This is our answer to mem0's coding-agent skills, and
it is the cheapest distribution we have.

### 3.4 Docs

Quickstart that works in under five minutes, API reference generated from the zod
schemas, error-code table.

### 3.5 Reposition the landing page

Lead with audit and explainability, not "memory". "Memory your compliance team can read"
is a sentence mem0's architecture cannot say — they chose silence over conflicts. Let
Experience Memory carry the agent story.

---

## Phase 4 — Platform (ongoing)

- **Ops surface:** batch remember, bulk delete, export, an `events` status endpoint,
  webhooks.
- **Guardrails:** per-key rate limits, idempotency keys, read/write key scopes.
- **BYO models:** provider interfaces behind `src/lib/anthropic.ts` and
  `src/lib/voyage.ts`, configurable per project. Enterprise buyers on Bedrock or Azure
  cannot adopt us otherwise.
- **Billing:** Stripe on top of `usage_events`, tier enforcement.
- **Security:** PII redaction at write time, dashboard audit log.

---

## Timeline

| Week | Phase |
|---|---|
| 1 | Phase 0 — tests, eval harness, baseline, CI |
| 2–3 | Phase 1 — append-only writes + async reconciliation |
| 4 | Phase 2 — hybrid retrieval, filters, scoping keys |
| 5–6 | Phase 3 — SDKs, MCP, docs, repositioning |
| 7+ | Phase 4 — platform and billing |

**If only three things happen:** the eval harness, the write-path split, and the
TypeScript SDK.

---

## Open decisions

1. **Open source or not.** mem0's 63.7k stars are a distribution flywheel we cannot beat
   from behind a closed repo. An Apache-2 core with a hosted tier is the standard answer;
   it also gives away the engine.
2. **Is Experience Memory a product or a feature?** It is the one thing mem0 has no
   equivalent of. It may deserve its own name, pricing and landing page.
3. **Which vertical carries the audit story** — support, fintech or health. The answer
   changes the docs, the examples and the first ten customers.

## Risks

- **Reconciliation lag is user-visible.** Mitigated by read-time collapsing (1.6), but a
  customer reading the dashboard mid-window sees duplicates. Needs a clear UI state.
- **Eval spend.** A full LoCoMo run costs real money on a frontier model. Nightly, not
  per-PR, and consider Haiku for the judge.
- **Dataset licensing.** Confirm LoCoMo and LongMemEval terms before publishing numbers.
- **Model cost.** If Haiku 4.5 scores within noise of Sonnet 5 on extraction, that alone
  fixes the unit economics.
