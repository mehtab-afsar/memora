# @memora/mcp

Memora as an MCP server: long-term memory for Claude Code, Cursor, and any MCP client.
The agent remembers what you told it last week, and what it learned failing a task last
month.

## Setup

Create an environment-scoped API key in the Memora dashboard, then add the server to your
client's MCP config:

```json
{
  "mcpServers": {
    "memora": {
      "command": "npx",
      "args": ["-y", "@memora/mcp"],
      "env": {
        "MEMORA_API_KEY": "sk_live_...",
        "MEMORA_USER_ID": "you@example.com"
      }
    }
  }
}
```

`MEMORA_USER_ID` is the end user this client writes for, so the agent does not have to
pass an id on every call. `MEMORA_BASE_URL` points the client at your own deployment.

In Claude Code: `claude mcp add memora --env MEMORA_API_KEY=sk_live_... -- npx -y @memora/mcp`

## Tools

| Tool | What it does |
|---|---|
| `remember` | Store something durable the user said — a preference, decision or constraint |
| `recall` | Retrieve what is known that bears on the current task, ranked and explained |
| `record_experience` | Record what happened attempting a task, especially failures |
| `recommend` | Ask what previous attempts suggest, before starting |

`recall` marks any memory that contradicts another as `CONFLICTS` rather than presenting
it as settled — the agent is told when the record is unresolved instead of picking a side
silently.
