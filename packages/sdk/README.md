# @memora/client

TypeScript client for the Memora memory API. No dependencies — `fetch` only, so it runs
on Node 18+, Bun, Deno and Workers. An API key is environment-scoped and belongs on a
server; never ship one to a browser.

```bash
npm install @memora/client
```

```ts
import { Memora } from "@memora/client";

const memora = new Memora({ apiKey: process.env.MEMORA_API_KEY! });

// Write what someone said. Memora decides what is worth keeping.
await memora.remember({
  userId: "user_123",
  content: "I prefer dark mode and I'm allergic to peanuts.",
});

// Ask for what matters now.
const { results } = await memora.recall({
  userId: "user_123",
  query: "any dietary restrictions?",
  topK: 5,
});

for (const memory of results) {
  console.log(memory.content, "—", memory.reason);
  // "Is allergic to peanuts — high semantic match (0.86), high confidence, recently confirmed"
}
```

## Writes are append-only

`remember()` returns as soon as the memories are stored. Each outcome carries
`reconciliation: "pending"` — the judgement about whether a memory is new, a new version
of an existing one, a restatement, or a contradiction happens straight afterwards, off
your request's latency path. `explain(memoryId)` shows where it landed, with the reason.

## Narrowing recall

```ts
await memora.recall({
  userId: "user_123",
  query: "deployment preferences",
  types: ["preference", "instruction"],
  minConfidence: 0.7,
  since: new Date("2026-01-01"),
  agentId: "support-bot",
});
```

## Errors

Every non-2xx throws a `MemoraError` with `status`, the API's `message`, and the parsed
`body`. Timeouts, 429s and 5xx are retried with backoff (`maxRetries`, default 2);
4xx are not, because retrying a malformed request cannot fix it.

```ts
import { MemoraError } from "@memora/client";

try {
  await memora.recall({ userId, query });
} catch (error) {
  if (error instanceof MemoraError && error.isAuthError) {
    // key missing, wrong, or revoked
  }
  throw error;
}
```

## Experiences

What an agent learned doing a task, separate from what is known about a user:

```ts
await memora.experiences.record({
  task: "Deploy the API to staging",
  action: "Ran the migration before the deploy",
  outcome: "failure",
  cause: "The migration referenced a column the new code had not shipped yet",
  resolution: "Deploy first, migrate second",
});

const advice = await memora.experiences.recommend("Deploy the API to staging");
// advice.recommendation, advice.reasoning, advice.supportingExperiences
```
