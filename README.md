# Memora

Memora is a hosted long-term memory layer for AI applications. Instead of stuffing raw conversation history into every prompt, your app sends Memora what a user said and Memora extracts durable facts, preferences, goals, and decisions from it — deduplicating, versioning, and scoring them for confidence over time. Later, a semantic `recall` call returns just the memories relevant to the current query, ranked by similarity, confidence, and freshness.

An LLM (Claude) does the reasoning at write time — extracting candidate memories from raw text and deciding whether each one should be added, merged into an existing memory, treated as an update (versioned), ignored as a redundant restatement, or flagged as contradicting something already known. Embeddings (Voyage AI) power the similarity search behind both that decision and recall.

## How it works

- **Remember** (`POST /api/v1/memories/remember`) — send free-form text plus a `user_id`. Memora extracts memory candidates in one LLM call, embeds them in one batched call, writes them all, and returns. Each new memory carries `reconciliation: "pending"`.
- **Reconciliation** (background) — once the response is sent, every written memory is judged against its nearest neighbours: `ADD`, `UPDATE`, `MERGE`, `IGNORE`, or `FLAG` (contradiction). Versions are linked, restatements retired, contradictions recorded — all with Claude's stated reasoning. The queue is a durable table, drained after each request and by `pnpm reconcile` for retries and backlog, so judgement never sits between a caller and their response.
- **Recall** (`POST /api/v1/memories/recall`) — send a `user_id` and a `query`. Memora embeds the query, finds the nearest active memories, and ranks them with a weighted score: semantic similarity (60%), confidence (25%), and freshness/recency (15%).
- **Explain** (`GET /api/v1/memories/:id/explain`) — returns a memory's full evidence trail and version history (every edit creates a new version linked via `supersedesId`; nothing is silently overwritten).
- **Verify** (`POST /api/v1/memories/:id/verify`) — asks the LLM to re-assess a memory's confidence/status given its age and evidence count.

Because writes are append-only, a fact and a newer restatement of it can both be active for the moments before reconciliation runs. `recall` collapses results by version chain and by near-duplicate similarity, so a caller sees one memory per fact either way.

Memories carry a `type` (`preference`, `fact`, `goal`, `relationship`, `event`, `instruction`, `decision`, `context`) and a `status` (`active`, `stale`, `superseded`, `archived`, `flagged`). Every write — extraction, reconfirmation, version update, manual edit, verification — is recorded as evidence, so any memory's history can be reconstructed from the dashboard.

## Structure

- **Organizations → Projects → Environments** — projects (e.g. one per app) contain environments (e.g. `development`/`production`), each with its own scoped API keys and memory data.
- **API keys** are environment-scoped bearer tokens (`Authorization: Bearer <key>`); every `/api/v1/*` call is authorized and scoped through one.
- **Dashboard** — a web UI (this Next.js app) for signing up, managing orgs/projects/environments/API keys, browsing and filtering memories, viewing per-memory evidence and version timelines, and an API playground for trying `remember`/`recall` without writing code.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + React, TypeScript
- PostgreSQL with [pgvector](https://github.com/pgvector/pgvector) for embedding similarity search, via [Drizzle ORM](https://orm.drizzle.team)
- [Auth.js](https://authjs.dev) for dashboard authentication
- [Anthropic](https://www.anthropic.com) (Claude) for memory extraction, decisioning, and verification
- [Voyage AI](https://www.voyageai.com) for embeddings
- Tailwind CSS + shadcn/ui components

## Getting started

1. Copy `.env.example` to `.env.local` and fill in `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, and `AUTH_SECRET` (`DATABASE_URL` and `AUTH_URL` already have working local defaults).
2. Start Postgres (with pgvector):
   ```bash
   docker compose up -d
   ```
3. Install dependencies and run migrations:
   ```bash
   pnpm install
   pnpm db:setup
   ```
4. Start the dev server:
   ```bash
   pnpm dev
   ```
5. Open [http://localhost:3000](http://localhost:3000), sign up, create a project and environment, and generate an API key from the dashboard.

## Client library

```bash
npm install @memora/client
```

```ts
import { Memora } from "@memora/client";

const memora = new Memora({ apiKey: process.env.MEMORA_API_KEY! });

await memora.remember({ userId: "user_123", content: "I prefer dark mode." });

const { results } = await memora.recall({ userId: "user_123", query: "ui preferences" });
```

Source in [`packages/sdk`](packages/sdk). Every result carries `reason`, `matchedOn` and
`status`, so an application can show *why* a memory came back — and flag the ones that
contradict something else rather than presenting them as settled.

## Development

```bash
pnpm test        # unit tests — no database, no network, no spend
pnpm typecheck
pnpm lint
pnpm eval        # scores the pipeline end to end against evals/datasets (costs money)
pnpm smoke       # end-to-end check against a running dev server
pnpm reconcile   # drain the reconciliation queue (--watch to keep running)
```

`pnpm eval` is the scoreboard: accuracy by category, latency, provider calls per
operation and dollars per 1,000 memories. See [`evals/README.md`](evals/README.md).

## Example API usage

```bash
curl -X POST http://localhost:3000/api/v1/memories/remember \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_123", "content": "I prefer dark mode and I'\''m allergic to peanuts."}'

curl -X POST http://localhost:3000/api/v1/memories/recall \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_123", "query": "any dietary restrictions?", "top_k": 5}'
```
