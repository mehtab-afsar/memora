# Making Memora genuinely AI-native

Written 21 August 2026, after an architecture review.

## The diagnosis

Memora uses AI well as a component and not at all as a system. Five model calls
extract, decide, verify, summarise and recommend — each one stateless, each one
running a prompt written by us months ago, each one blind to whether its last
ten thousand answers were any good.

That produces three symptoms:

1. **It does not improve.** The extraction prompt behaves identically for a
   customer on day 1 and day 400. Nothing the system observes changes what it
   does next.
2. **It does not reason across what it holds.** `recall` is search. Ask it about
   a person and it returns ten disconnected strings, never a coherent
   understanding — which is why one dense conversation produced 210 memories and
   the right fact still missed the top five.
3. **It does not know its own uncertainty.** Confidence is guessed once at
   extraction and only revisited if a human calls `verify`. Nothing proactively
   asks "which of these do I probably have wrong?"

A memory product that cannot answer those three is a database with a language
model bolted on. The plan below fixes each, in order of value.

## What we are deliberately not doing

Worth stating first, because the obvious moves here are the wrong ones.

- **No agent loop in the write path.** Letting a model plan and call tools in a
  loop would make writes slower, costlier, less debuggable, and no more correct.
  Single-shot forced tool calls with strict schemas are the right design for a
  pipeline that has to be auditable. Being "agentic" is not a goal.
- **No "chat with your memories" feature.** It demos well and solves nothing an
  API caller cannot already do.
- **No fine-tuning yet.** Expensive, slow to iterate, and it locks in behaviour
  before we know what good behaviour is. Every adaptation below is achievable
  with retrieval and prompting first. Revisit once the feedback loop has run for
  a year and we have a corpus worth training on.

---

## 1. Close the feedback loop  — **built, 21 Aug 2026**

*The single most AI-native property a product can have: it gets better the more
it is used, per customer, without anyone retraining anything.*

Shipped as `src/lib/feedback.ts`. Building it surfaced a real bug: when
reconciliation returned `IGNORE` with no target — its way of saying "too
trivial to persist at all" — the write path did nothing, so the memory stayed
active. The system judged something not worth keeping and kept it, and threw
away the cleanest negative example extraction ever gets. Both are fixed.

Verified end to end against a live database: a fresh project renders no
examples and its prompt is byte-identical to the unlearned one; after one write,
one human archive and one recall, the next extraction sees a positive example
("retrieved 1 time to answer a question") and a negative one ("a person archived
this as not worth keeping").

Every reconciliation verdict is a graded example of extraction's work, and we
already store all of them:

| Signal we already have | What it means |
|---|---|
| `IGNORE` with a target | Extraction produced a redundant restatement |
| Archived within 24h | Extraction produced something not worth keeping |
| `FLAG` a human dismissed | A false contradiction |
| Reconfirmed 3+ times | A fact that genuinely matters to this user |
| `UPDATE` chains | A field that changes often, so freshness matters more here |

**Build:**

- A `extraction_outcomes` view over `memories` + `memory_evidence` +
  `reconciliation_jobs` that labels every extracted candidate with what became
  of it.
- **Per-project few-shot injection.** Before extracting, pull that project's
  most recent 5 kept and 5 discarded examples and put them in the prompt. The
  system learns *this customer's* notion of what is worth remembering — a legal
  SaaS and a fitness app disagree profoundly about that, and today they get the
  same prompt.
- **A survival metric.** "What fraction of extracted memories are still active
  after 30 days?" per project. This is the closest thing to a precision number
  we can compute without human labels, and it is a genuine product metric.

**Measured by:** the extraction eval, plus survival rate trending up per project.

**Why it matters commercially:** it makes the product stickier the longer it
runs, and it is a moat that a competitor cannot copy by reading our docs.

---

## 2. Consolidation — reason over the corpus, not the row

*This is how humans actually remember. We do not recall 210 facts about someone;
we hold a model of them and retrieve specifics on demand.*

Today every memory is an independent row and recall ranks them against each
other. At scale that fails structurally: 210 near-equally-scored facts, top-5
retrieval, and the answer is somewhere in the tail.

**Build:**

- A periodic **consolidation job** per user, triggered by memory count or age.
  It reads the active set and produces a compact synthesis:

  > *Priya — vegan, severe peanut allergy (confirmed 3×). Moved Berlin → Lisbon
  > July 2026. Works at Cobalt Labs, platform team. Prefers morning meetings.*

- Stored as a first-class memory of type `profile`, linked to every source it
  drew on, with its own evidence row and reasoning. It supersedes nothing — it
  sits alongside.
- **Recall returns the profile plus the specifics.** The profile gives the
  caller the shape of the person in one paragraph; the ranked memories give
  detail. The 210-memory problem stops being a ranking problem, because the
  answer is no longer competing with 209 siblings.
- Consolidation is where genuine reasoning belongs: noticing that four separate
  memories are facets of one fact, that a stated goal was quietly abandoned,
  that two preferences are in tension without formally contradicting.

**Measured by:** LoCoMo multi-hop and single-hop categories, where "the right
fact never surfaced" is currently the dominant failure.

---

## 3. Retrieval that reasons about the question

Today every query is treated identically: embed it, search, rank by the same
weights. But "when did she run the race?" and "what is her cluster called?" and
"what should I know before booking dinner?" want three completely different
retrieval strategies — and our benchmark scores by category prove it (temporal
50%, exact-string 100%).

**Build:**

- One cheap classifier call (Haiku, ~200ms) that routes the query:

| Kind | Strategy |
|---|---|
| Temporal | Filter and sort by `occurred_at`; weight recency far higher |
| Identifier lookup | Keyword-first, semantic as fallback |
| Profile / open-ended | Return the consolidated profile, few specifics |
| Multi-hop | Two-pass: retrieve, then retrieve again using entities found in pass one |
| Unanswerable | Return nothing rather than the least-bad match |

- Two-pass retrieval for multi-hop is the piece that needs real reasoning: the
  first pass finds "sister Priya lives in Lisbon", the second uses *Lisbon* as a
  new query. That is a chain a single embedding search cannot make.

**Measured by:** per-category LoCoMo scores. This work is only justified if
temporal and multi-hop move.

---

## 4. Memory that audits itself

We sell an audit trail. Today it is passive — it answers when asked. An
AI-native version notices problems before the customer does.

**Build:** a background reviewer that continuously looks for:

- High-importance memories that have not been confirmed in a long time
- Memories resting on a single thin piece of evidence
- Unresolved contradictions older than N days
- Memories that conflict with the consolidated profile but were never flagged
  pairwise
- Facts whose type implies volatility (job, address, project) and whose age
  exceeds what that type usually survives — learned from `UPDATE` chains, per §1

Surfaced as a **"needs attention" queue** in the dashboard, and available as an
API. This turns the compliance story from *"we can answer questions"* into
*"we raise our hand"*, which is a materially stronger sales position.

---

## 5. Evaluation on live traffic, not just in CI

We have an eval harness, which is already rarer than it should be. But it runs
on 14 hand-written questions and a 20-question benchmark sample. Meanwhile the
production system answers real recalls all day and nobody grades any of them.

**Build:**

- **Shadow evaluation.** Sample ~1% of real recalls, replay them offline
  against a judge, store the verdict. No customer impact, real signal.
- **Quality dashboards per project**, and alerts on drift — because the day a
  model provider silently changes behaviour, we should find out from our own
  metrics rather than a customer.
- Promote genuinely hard sampled cases into the golden set, so the regression
  suite grows from reality rather than from imagination.

**Why this matters:** it is the difference between an AI feature and an AI
product. Products that cannot measure their own quality in production
eventually regress and never notice.

---

## 6. Experience Memory — the part that is actually novel

The competitor has no equivalent, and we have it half-built: an agent records
what it attempted and what happened, and gets advice before the next attempt.

**Build:**

- **Close the outcome loop.** When an agent follows a recommendation, record
  whether it worked. Recommendations that lead to success should outrank ones
  that do not — this is a bandit problem with a clean reward signal, and it is
  the only place in the product where reinforcement genuinely fits.
- **Fleet learning.** One agent's failure should inform every other agent in the
  project immediately.
- **Give it its own name, page and price.** Today it is a tab.

This is the most defensible thing in the product and the least finished.

---

## Sequencing

| Order | Work | Why here |
|---|---|---|
| 1 | Feedback loop (§1) | Uses data we already have; compounding value; nothing depends on it |
| 2 | Consolidation (§2) | Fixes the measured failure mode; unblocks §3's profile route |
| 3 | Retrieval routing (§3) | Needs `occurred_at` and consolidation to pay off fully |
| 4 | Self-auditing (§4) | Needs §1's learned volatility signals |
| 5 | Shadow evaluation (§5) | Needs production traffic, so it needs a deploy first |
| 6 | Experience Memory (§6) | Independent; can run in parallel whenever it is prioritised |

Two dependencies from the existing plan block real progress here: **event
timestamps** (`occurred_at`) gate §3, and **a deployment with live traffic**
gates §5.

## The test for whether this worked

In six months, we should be able to say all four:

- *The system extracts better for a customer of one year than for a new one, and
  we can show the curve.*
- *Asking about a person returns an understanding, not a list.*
- *The system tells us which of its own memories are probably wrong.*
- *We know our production accuracy this week, and whether it moved.*

None of that is achievable by adding agents. All of it is achievable by making
the system learn from what it already sees.
