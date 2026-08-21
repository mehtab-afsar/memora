# Deploying Memora

What it takes to run this for someone other than yourself, and what is still
missing when you do.

## What you need first

| Thing | Why | Notes |
|---|---|---|
| Postgres 16 with `pgvector` | Every memory and its embedding lives here | Managed is the right answer. Neon, Supabase and RDS all support pgvector. |
| Anthropic API key | Extraction, reconciliation, verification | |
| Voyage API key **with a payment method** | Embeddings | Without one the account is capped at **3 requests per minute**, which is not a rate limit so much as an outage. Nothing works properly until this is done. |
| `AUTH_SECRET` | Signs dashboard session cookies | `openssl rand -base64 32`. Changing it logs everyone out. |
| A domain and TLS | | Terminate TLS at the load balancer; the container speaks plain HTTP on 3000. |

## Build and run

```bash
cp .env.example .env.production   # then fill it in
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

That brings up four things: Postgres, a one-shot `migrate` container, the app,
and the reconciliation worker. The app will not start until migrations have
completed, so a deploy can never serve traffic against a schema it does not
expect.

For a managed database, drop the `postgres` service and point `DATABASE_URL` at
the managed instance. Everything else is unchanged.

### The image

Multi-stage, ~290 MB, runs as a non-root user, and ships the traced standalone
server rather than `node_modules`. Migrations are copied into the image so the
schema and the code that expects it always travel together.

One non-obvious thing is load-bearing: the image installs dependencies with
`node-linker=hoisted`. Next's standalone output traces the files the server
needs, and with pnpm's symlinked store that trace misses transitive
dependencies reached through symlinks — `@swc/helpers` is the first to surface,
as a `MODULE_NOT_FOUND` **at boot**, not at build. Hoisting inside the image
fixes it. Do not remove that line without booting the built image.

## Health

`GET /api/v1/health` returns 200 with `{"status":"ok","database":"ok"}`, or 503
when the database is unreachable. It is unauthenticated and says nothing else.
Point both the container healthcheck and the load balancer at it — "the process
is up" and "this instance can serve a request" are different questions.

## Migrations

```bash
pnpm drizzle-kit generate   # after changing src/db/schema.ts
pnpm db:setup               # create extensions, then migrate
```

`pnpm db:setup` rather than `drizzle-kit migrate` on a database that has never
been used before: `memories` declares a `vector(1024)` column, so pgvector has
to exist before the first migration runs. Without it, `drizzle-kit migrate`
exits non-zero and prints nothing at all. The `migrate` service in the compose
file runs `db:setup`, so a fresh deploy handles it — but if you point
`DATABASE_URL` at a managed instance, check the provider lets you enable
`vector` first.

Migrations are additive so far — new tables, new nullable columns, new indexes —
so a rollback of the app does not require a rollback of the schema. Keep it that
way: if you need to drop or rename a column, ship it as two deploys (stop
writing it, then remove it) rather than one.

## Backups

Nothing here backs anything up. Before real customers:

```bash
# Dump
pg_dump "$DATABASE_URL" --format=custom --file=memora-$(date +%F).dump

# Restore into an empty database
pg_restore --dbname="$TARGET_URL" --clean --if-exists memora-2026-08-20.dump
```

A managed provider gives you point-in-time recovery, which is what you actually
want. **Test a restore before you need one** — an untested backup is a belief,
not a backup.

## Scaling

- **The app is stateless.** Run as many instances as you like behind a load
  balancer.
- **Rate limits and idempotency are counted in Postgres**, not in process
  memory, so limits stay correct across instances. An in-memory counter would
  quietly multiply every limit by the number of instances.
- **Reconciliation drains after each response** via `after()`, and the worker
  covers retries and backlog. Run exactly one worker to start; it claims jobs
  with `FOR UPDATE SKIP LOCKED`, so more than one is safe when you need it.
- **The worker also sweeps** the rate-limit and idempotency tables every ten
  minutes. Without it they grow forever.

## Operating

```bash
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f reconciler
pnpm reconcile                     # drain the queue once, by hand
```

Failed reconciliation jobs stay in `reconciliation_jobs` with
`status = 'failed'` and their last error. Watch that count:

```sql
select status, count(*) from reconciliation_jobs group by status;
select last_error, count(*) from reconciliation_jobs
 where status = 'failed' group by last_error order by 2 desc;
```

A memory whose job failed is stored and readable but never judged — no version
link, no contradiction flag. It shows as "Unreconciled" in the dashboard.

## Limits and plans

Plan ceilings live in `src/lib/plans.ts`, not in the database, so changing what
a plan includes is a reviewed diff. Only the plan name is stored, on
`organizations.plan`. Every `/api/v1` request is checked against:

1. **Scope** — the key holds `read`, `write`, or both. 403 otherwise.
2. **Rate limit** — requests per minute per key, counted in a fixed window. 429
   with `Retry-After`.
3. **Monthly quota** — writes and reads per calendar month, counted from
   `api_requests`. 402, because waiting does not fix it.
4. **Idempotency** — `Idempotency-Key` on writes replays the original response;
   the same key with a different body is a 409.

The numbers are placeholders until pricing is decided. The enforcement is not.

## What is still missing

Say this out loud before onboarding anyone:

- **No billing.** Usage is metered per call (`usage_events`) and per request
  (`api_requests`), which is the hard half — but nothing charges anyone, and
  nothing stops a free account from spending your model budget beyond its quota.
- **No error tracking or alerting.** Failures land in container logs. Nobody is
  paged.
- **Accounts are single-owner.** No invites, no roles, no password reset, no
  email verification.
- **No PII handling and no dashboard audit log.** You will be storing personal
  data belonging to other companies' users; a ToS, a privacy policy and a DPA
  are not optional.
- **No load test.** The write path has never been run at concurrency, because
  the Voyage rate limit makes that impossible today.
