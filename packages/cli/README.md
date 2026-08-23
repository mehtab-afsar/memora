# @memora/cli

Agent-first signup for Memora: mint a working API key with no email, password, or
dashboard click. Built for an agent (Claude Code, Cursor, a CI job) to provision its own
memory backend instead of waiting on a human to click through a signup form.

## Usage

```bash
npx @memora/cli init --agent --json
```

Returns:

```json
{
  "apiKey": "sk_test_...",
  "orgId": "...",
  "projectId": "...",
  "environmentId": "...",
  "claimUrl": "https://.../claim/..."
}
```

The key works immediately — set it as `MEMORA_API_KEY` and start calling `@memora/client`
or `@memora/mcp`. Nothing about it depends on `claimUrl` ever being visited.

Drop `--json` for a human-readable version of the same thing.

## Claiming

`claimUrl` lets a person take ownership of the workspace an agent just created for
itself — sign in (or sign up) and click claim. It's optional: skipping it does not
revoke or weaken the key. It does expire, though — an unclaimed workspace's key stops
working after the claim link's window closes, so if a human is meant to own this
eventually, don't let it sit unclaimed indefinitely.

## Configuration

| Flag / env | Default | What it does |
|---|---|---|
| `--base-url` / `MEMORA_BASE_URL` | `https://api.memora.dev` | Which Memora deployment to talk to — point this at a self-hosted instance. Same convention `@memora/client` and `@memora/mcp` use. |
