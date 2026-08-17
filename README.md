# Memora

Memora is a hosted long-term memory layer for AI applications. Instead of stuffing raw conversation history into every prompt, your app sends Memora what a user said and Memora extracts durable facts, preferences, goals, and decisions from it — deduplicating, versioning, and scoring them for confidence over time. Later, a semantic `recall` call returns just the memories relevant to the current query, ranked by similarity, confidence, and freshness.

An LLM (Claude) does the reasoning at write time — extracting candidate memories from raw text and deciding whether each one should be added, merged into an existing memory, treated as an update (versioned), ignored as a redundant restatement, or flagged as contradicting something already known. Embeddings (Voyage AI) power the similarity search behind both that decision and recall.

## How it works

- **Remember** (`POST /api/v1/memories/remember`) — send free-form text plus a `user_id`. Memora extracts memory candidates, embeds each one, finds nearby existing memories for that user, and asks the LLM to decide: `ADD`, `UPDATE`, `MERGE`, `IGNORE`, or `FLAG` (contradiction).
- **Recall** (`POST /api/v1/memories/recall`) — send a `user_id` and a `query`. Memora embeds the query, finds the nearest active memories, and ranks them with a weighted score: semantic similarity (60%), confidence (25%), and freshness/recency (15%).
- **Explain** (`GET /api/v1/memories/:id/explain`) — returns a memory's full evidence trail and version history (every edit creates a new version linked via `supersedesId`; nothing is silently overwritten).
- **Verify** (`POST /api/v1/memories/:id/verify`) — asks the LLM to re-assess a memory's confidence/status given its age and evidence count.

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
   pnpm drizzle-kit migrate
   ```
4. Start the dev server:
   ```bash
   pnpm dev
   ```
5. Open [http://localhost:3000](http://localhost:3000), sign up, create a project and environment, and generate an API key from the dashboard.

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
