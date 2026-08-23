#!/usr/bin/env node

/**
 * Agent-first signup: mints a working Memora API key with no email or
 * password, in one HTTP call to `POST /api/v1/agent-init`. A human claims
 * ownership later at the printed `claimUrl` — the key works either way.
 *
 * No dependencies, hand-rolled argv parsing: this is one command, and
 * `@memora/client` already sets the precedent of "fetch only, no deps".
 */

const DEFAULT_BASE_URL = "https://api.memora.dev";

function flagValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

function usage(): void {
  console.error(
    [
      "Usage: memora init --agent [--json] [--base-url <url>]",
      "",
      "Provisions a Memora workspace and a working API key with no email or",
      "password. Prints a claim URL a human can visit later to take ownership —",
      "the key works whether or not it's ever claimed.",
    ].join("\n")
  );
}

async function initAgent(argv: string[]): Promise<void> {
  const json = argv.includes("--json");
  const baseUrl = (flagValue(argv, "--base-url") ?? process.env.MEMORA_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v1/agent-init`, { method: "POST" });
  } catch (err) {
    console.error(`Could not reach ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
    return;
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error ?? `HTTP ${response.status}`;
    console.error(`Could not create a workspace: ${message}`);
    process.exitCode = 1;
    return;
  }

  const result = body as { apiKey: string; orgId: string; projectId: string; environmentId: string; claimUrl: string };

  if (json) {
    console.log(JSON.stringify(result));
    return;
  }

  console.log(
    [
      "Workspace created.",
      "",
      `  API key:  ${result.apiKey}`,
      `  Project:  ${result.projectId}`,
      "",
      "Set this as MEMORA_API_KEY to start using it right away.",
      "",
      "To claim this workspace as your own (recommended, not required), open:",
      `  ${result.claimUrl}`,
      "",
      "Nothing is lost if you skip this — the key keeps working either way.",
    ].join("\n")
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv[0] !== "init" || !argv.includes("--agent")) {
    usage();
    process.exitCode = 1;
    return;
  }

  await initAgent(argv);
}

main();
