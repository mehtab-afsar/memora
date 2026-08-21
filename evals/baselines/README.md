# Baselines

Eval runs worth keeping. Everything else `pnpm eval` writes goes to
`evals/results/`, which is gitignored — those are scratch, and reproducible.

| File | What it is |
|---|---|
| `2026-08-20-golden.json` | 100% (14/14) on the hand-built golden set. A regression alarm, not a benchmark: these questions were written to catch known failures and then tuned against until they passed. |
| `2026-08-20-locomo-sample.json` | 75% (15/20) on a stratified sample of LoCoMo — the first data the system had never been tuned against, and the honest number. Temporal is the weak category at 50%; three of the five misses were retrieval never surfacing the right fact out of 210 memories for one user. |
| `2026-08-21-extraction.json` | 15/16 on the extraction set. The one failure was a transient — a model call returned a memory whose content was the single word "test" — which passed 6/6 on a re-run. |

Promote a run by copying it here with a dated name and adding a row above.
Say what the number means, not just what it is.
