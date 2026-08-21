# Quickstart

Five minutes from nothing to a memory your application can recall.

## 1. Get a key

Sign up, create a project, and generate an API key from **Settings → API keys**. Keys are
scoped to one environment, so a `development` key can never read `production` memories.

```bash
export MEMORA_API_KEY=sk_test_...
```

## 2. Write something

```bash
curl -X POST https://api.memora.dev/api/v1/memories/remember \
  -H "Authorization: Bearer $MEMORA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "content": "I prefer dark mode, I am allergic to peanuts, and I only take morning meetings."
  }'
```

```json
{
  "outcomes": [
    { "candidateContent": "Prefers dark mode", "decision": "ADD", "memoryId": "…", "reconciliation": "pending" },
    { "candidateContent": "Is allergic to peanuts", "decision": "ADD", "memoryId": "…", "reconciliation": "pending" },
    { "candidateContent": "Only takes morning meetings", "decision": "ADD", "memoryId": "…", "reconciliation": "pending" }
  ]
}
```

Three durable facts out of one sentence. `"reconciliation": "pending"` means each one is
stored and readable now, and is being compared against what is already known in the
background — that comparison is what links versions and flags contradictions, and it does
not sit between you and your response.

## 3. Ask for what matters

```bash
curl -X POST https://api.memora.dev/api/v1/memories/recall \
  -H "Authorization: Bearer $MEMORA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "user_id": "user_123", "query": "anything I should know before booking lunch?", "top_k": 3 }'
```

```json
{
  "results": [
    {
      "content": "Is allergic to peanuts",
      "type": "fact",
      "status": "active",
      "relevanceScore": 0.87,
      "similarity": 0.84,
      "confidence": 0.95,
      "freshness": 0.99,
      "matchedOn": "both",
      "reason": "high semantic match (0.84), high confidence, recently confirmed"
    }
  ]
}
```

You get the memories that bear on the question — not the transcript they came from — and
each one says why it was returned.

## 4. Put it in the prompt

```ts
import { Memora } from "@memora/client";

const memora = new Memora({ apiKey: process.env.MEMORA_API_KEY! });

const { results } = await memora.recall({ userId, query: userMessage, topK: 5 });

const system = [
  "What you know about this user:",
  ...results.map((m) => `- ${m.content}${m.status === "flagged" ? " (conflicts with another memory — ask, don't assume)" : ""}`),
].join("\n");
```

Then write the turn back:

```ts
await memora.remember({ userId, content: userMessage });
```

That is the whole loop: recall before you answer, remember after.

## What to reach for next

| You want | Use |
|---|---|
| Why a memory says what it says | `GET /api/v1/memories/:id/explain` — evidence trail and version history |
| To re-check an old memory | `POST /api/v1/memories/:id/verify` |
| Only preferences, only recent, only one agent | `type`, `since`, `agent_id` on recall |
| An agent that learns from its own attempts | `POST /api/v1/experiences/record`, then `/recommend` |
| Memory inside Claude Code or Cursor | [`@memora/mcp`](../packages/mcp/README.md) |

## Things worth knowing

- **Nothing is overwritten.** A changed fact becomes a new version linked to the old one;
  the old one stays readable with the reason it was replaced.
- **Contradictions are surfaced, not resolved.** When two memories cannot both be true,
  both come back marked `flagged`. Ask the user; don't let the system guess.
- **Restatements are confirmations.** Saying the same thing again raises a memory's
  freshness rather than duplicating it.
