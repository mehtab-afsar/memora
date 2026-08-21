# Prompt caching

Every Claude call in this system has the same shape: a large fixed instruction,
one fixed tool schema, and one short piece of per-request text. Extraction's
prompt is 1,869 tokens before it sees a word of the user's input, which is
roughly 90% of the request.

That is what "why does one write cost 2,000 tokens?" turns out to mean. The
answer is not that the input is large — it is that the instructions are, and
they were being re-read and re-charged on every single call.

## What changed

`callTool()` in [src/lib/anthropic.ts](../src/lib/anthropic.ts) now sends the
system prompt as cacheable blocks. Anthropic renders a request as
`tools → system → messages`, so a breakpoint on the last system block caches the
tool definition and the instructions together, and only the caller's own text is
charged at full price.

Measured, on Sonnet 5 introductory rates:

| Stage | Cached prefix | Per 1,000 calls | Was | Saving |
|---|---:|---:|---:|---:|
| Extraction | 1,869 tokens | $3.25 | $6.61 | 51% |
| Decision | 1,386 tokens | $4.30 | $6.80 | 37% |
| **One write, end to end** | | **$7.55** | **$13.41** | **44%** |

Reproduce with `pnpm cache:probe`. Extraction saves more because its prompt is
larger relative to its input; the decision call carries the candidate and its
neighbours in the message, so more of it is genuinely per-request.

## Two design decisions

**The learned examples get their own cache block.** Extraction appends examples
drawn from a project's own history ([src/lib/feedback.ts](../src/lib/feedback.ts)),
and those change as a project accumulates memories. They used to be concatenated
onto the base prompt with `+`. Cached that way, every project would have its own
copy of the shared instructions, and every change to a project's examples would
invalidate them again. Split into two blocks with two breakpoints, the base is
one entry shared by the whole system and the examples are one entry per project.

**Caching is always on, not conditional on volume.** A cache write costs 1.25x
and a read 0.1x, so two calls inside the five-minute window break even; a project
writing one memory an hour pays about 20% more. That is the right trade because
cost is volume-weighted — the projects responsible for nearly all of the bill are
exactly the ones calling often enough to hit the cache, and 20% more of a very
small number is not worth a code path.

## The accounting trap

`usage.input_tokens` counts **only what was processed at full price**. Once
caching is on, the cached prefix is reported separately in
`cache_read_input_tokens` and `cache_creation_input_tokens`.

Anything summing `input + output` therefore silently under-counts by however much
was cached — here, most of the prompt. `usage_events` stores all four numbers
and [src/lib/usage.ts](../src/lib/usage.ts) sums the prompt as
`input + cache_read + cache_write`. Getting this wrong would not have thrown; it
would just have reported a number that was 80% too low.

## Checking it still works

Caching fails silently and looks exactly like working code — a byte of drift in
the prefix and every call pays the write premium while reading nothing back.
Two ways to notice:

- **`pnpm cache:probe`** runs both stages three times and prints the write/read
  split per call. A second call reading zero means the prefix is drifting.
- **The Usage page** shows the share of prompt tokens served from cache. A
  healthy busy project sits near 90%.

If the probe shows drift, the cause is something varying inside the prefix.
Candidates, in order of likelihood: a timestamp or id interpolated into a system
prompt, a tool schema built from a `Set` or an unsorted object, or a model
switched mid-flight (caches are model-scoped, so `MEMORA_MODEL` changes rebuild
everything).

## Not done

- **Concurrent cold starts.** A cache entry is only readable once the first
  response begins streaming, so when the reconciliation worker starts several
  users' jobs at once from cold, each pays its own write. Pre-warming with a
  `max_tokens: 0` call at worker boot would fix it. It is one write's premium per
  boot — real, but small enough that it has not been worth the code.
- **The 1-hour TTL.** Doubles the write cost and needs three calls to break even
  rather than two. Worth revisiting if traffic turns out to be bursty with long
  gaps; the default five minutes is the right guess for continuous API traffic.
- **The router.** `routeQuery` runs on Haiku 4.5, whose minimum cacheable prefix
  is 4,096 tokens — well above that prompt. The marker is harmless and does
  nothing.
