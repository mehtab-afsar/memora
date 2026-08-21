# Evals

The scoreboard. Every change to extraction, reconciliation or retrieval should be
argued with a number from here, not with a description of the change.

```bash
pnpm eval                                  # full golden set
pnpm eval --case job-change --keep         # one case, leave the data behind to inspect
pnpm eval --tag before-hybrid              # name the run; the tag lands in the filename
MEMORA_MODEL=claude-haiku-4-5 pnpm eval    # score the pipeline on a cheaper model
```

Each run provisions a throwaway org/project/environment, replays every case through
`remember()`, drains the reconciliation queue, then asks each question through `recall()`
and answers it **using only what recall returned** — so a retrieval miss shows up as a
wrong answer instead of being covered by the model's own knowledge. A second model grades
that answer against the reference. The project is deleted afterwards unless `--keep`.

Results are written to `evals/results/<timestamp>-<tag>.json` with every question, its
answer, the verdict and the reason.

## What it reports

| Metric | Why |
|---|---|
| Accuracy, overall and by category | Categories match LoCoMo's splits so our numbers sit beside the published ones |
| Write / reconcile / read latency | Reconcile time is reported separately because it is off the caller's path |
| **Provider calls per operation** | The latency metric that survives rate limiting — and the one Phase 1 set out to move |
| Memories per `remember()` | Storage growth, the cost of append-only writes |
| $ per 1,000 memories | The number pricing should be argued from |

## Rate limits

A Voyage account without a payment method is capped at **3 requests per minute**. The
harness sets `VOYAGE_MAX_RPM=3` so a run completes instead of dying on a 429 — but every
wall-clock latency figure it prints is then dominated by waiting, and means nothing.
Latency claims need a paid Voyage account first.

## Datasets

`golden.json` ships here: a small hand-built set covering the behaviours Memora claims —
facts that change over time, facts that must be combined, exact identifiers,
contradictions, restatements, and questions the system should refuse to answer. It is
cheap enough to run on every write-path change.

LoCoMo and LongMemEval are **not** redistributed. Convert a release into the same shape —
`{ name, description, cases: [{ id, userId, sessions, questions }] }` — drop it in
`evals/datasets/`, and check the licence before publishing any number derived from it.
