import { loadEnv, requireEnv } from "../evals/env";
import { Memora } from "../packages/sdk/src/index";

/**
 * End-to-end smoke test against a running dev server. Unlike the eval, which
 * calls the engine directly, this goes through the real HTTP surface: API key
 * auth, the route handlers, the post-response reconciliation drain, and the
 * TypeScript SDK — the whole path a customer actually touches.
 *
 *   pnpm dev                          # in another terminal
 *   pnpm smoke [--url http://localhost:3001]
 *
 * Provisions a throwaway org/project/environment and key, and deletes them
 * afterwards unless --keep.
 */

async function main() {
  loadEnv();
  requireEnv("DATABASE_URL", "ANTHROPIC_API_KEY", "VOYAGE_API_KEY");

  const argv = process.argv.slice(2);
  const flag = (name: string) => {
    const i = argv.indexOf(name);
    return i === -1 ? null : argv[i + 1] ?? null;
  };
  const baseUrl = flag("--url") ?? "http://localhost:3001";
  const keep = argv.includes("--keep");

  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const { organizations, projects, environments, apiKeys } = await import("@/db/schema");
  const { generateApiKey } = await import("@/lib/api-keys");

  const stamp = new Date().toISOString();
  const [org] = await db.insert(organizations).values({ name: `smoke-${stamp}` }).returning();
  const [project] = await db.insert(projects).values({ orgId: org.id, name: "smoke" }).returning();
  const [environment] = await db
    .insert(environments)
    .values({ projectId: project.id, name: "development" })
    .returning();

  const key = generateApiKey(environment.name);
  await db.insert(apiKeys).values({
    environmentId: environment.id,
    name: "smoke",
    keyPrefix: key.prefix,
    keyHash: key.hash,
  });

  // A second key with only the read scope, to prove scoping is enforced by the
  // server rather than merely recorded on the row.
  const readOnly = generateApiKey(environment.name);
  await db.insert(apiKeys).values({
    environmentId: environment.id,
    name: "smoke-readonly",
    keyPrefix: readOnly.prefix,
    keyHash: readOnly.hash,
    scopes: ["read"],
  });

  const memora = new Memora({ apiKey: key.fullKey, baseUrl, timeoutMs: 120_000 });
  const userId = `smoke_${Date.now()}`;
  let failures = 0;

  const check = (label: string, ok: boolean, detail?: unknown) => {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
    if (!ok) {
      failures += 1;
      if (detail !== undefined) console.log("        ", JSON.stringify(detail));
    }
  };

  try {
    console.log(`\nSmoke test against ${baseUrl}\n`);

    // --- auth ------------------------------------------------------------
    const unauthorized = await new Memora({ apiKey: "sk_test_nope", baseUrl })
      .recall({ userId, query: "anything" })
      .then(() => null)
      .catch((error: unknown) => error as { status?: number });
    check("a bad API key is rejected with 401", unauthorized?.status === 401, unauthorized);

    // --- write -----------------------------------------------------------
    const written = await memora.remember({
      userId,
      content: "I'm based in Berlin and I only take morning meetings. My cluster is atlas-stg-2.",
      agentId: "smoke-agent",
      sessionId: "smoke-session",
      source: { type: "smoke", id: "1" },
    });
    check("remember() returns outcomes", written.outcomes.length > 0, written);
    check(
      "every write comes back pending reconciliation",
      written.outcomes.every((o) => o.reconciliation === "pending"),
      written.outcomes
    );

    // --- the post-response drain ----------------------------------------
    // after() runs once the response is sent, so give it a moment before
    // asking whether the queue emptied.
    const memoryId = written.outcomes[0]?.memoryId;
    let reconciled = false;
    for (let attempt = 0; attempt < 30 && !reconciled; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      const { memories } = await memora.list({ userId, limit: 50 });
      reconciled = memories.length > 0 && memories.every((m) => m.reconciledAt !== null);
    }
    check("after() drained the reconciliation queue", reconciled);

    // --- read ------------------------------------------------------------
    const recalled = await memora.recall({ userId, query: "where are they based?", topK: 5 });
    check("recall() finds the Berlin memory", recalled.results.some((r) => /berlin/i.test(r.content)), recalled.results);
    check(
      "every result explains itself",
      recalled.results.every((r) => r.reason.length > 0 && r.relevanceScore > 0),
      recalled.results
    );

    const exact = await memora.recall({ userId, query: "atlas-stg-2", topK: 5 });
    check(
      "the exact identifier is retrievable",
      exact.results.some((r) => r.content.includes("atlas-stg-2")),
      exact.results
    );

    // --- filters ---------------------------------------------------------
    const filtered = await memora.recall({ userId, query: "meetings", agentId: "no-such-agent" });
    check("agent_id filtering excludes other agents' memories", filtered.results.length === 0, filtered);

    // --- explain ---------------------------------------------------------
    if (memoryId) {
      const detail = (await memora.explain(memoryId)) as {
        evidence?: unknown[];
        reconciliation?: { status: string };
      };
      check("explain() returns an evidence trail", (detail.evidence?.length ?? 0) > 0, detail.evidence);
      check("explain() reports reconciliation state", detail.reconciliation?.status === "done", detail.reconciliation);
    }

    // --- guards ----------------------------------------------------------
    const rawPost = (apiKey: string, path: string, body: unknown, headers: Record<string, string> = {}) =>
      fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });

    const writeAttempt = await rawPost(readOnly.fullKey, "/api/v1/memories/remember", {
      user_id: userId,
      content: "A read-only key should not be able to write this.",
    });
    check("a read-only key cannot write", writeAttempt.status === 403, await writeAttempt.clone().json());

    const readAttempt = await rawPost(readOnly.fullKey, "/api/v1/memories/recall", {
      user_id: userId,
      query: "where are they based?",
    });
    check("a read-only key can still read", readAttempt.status === 200);
    check(
      "responses carry rate-limit headers",
      readAttempt.headers.get("RateLimit-Limit") !== null &&
        readAttempt.headers.get("RateLimit-Remaining") !== null,
      Object.fromEntries(readAttempt.headers)
    );

    const idempotencyKey = `smoke-${Date.now()}`;
    const body = { user_id: userId, content: "Prefers espresso over drip coffee." };
    const first = await rawPost(key.fullKey, "/api/v1/memories/remember", body, {
      "Idempotency-Key": idempotencyKey,
    });
    const firstBody = await first.text();
    check("an idempotent write succeeds", first.status === 200);

    const replay = await rawPost(key.fullKey, "/api/v1/memories/remember", body, {
      "Idempotency-Key": idempotencyKey,
    });
    const replayBody = await replay.text();
    check("replaying the key returns the original response", replayBody === firstBody);
    check("the replay is marked as one", replay.headers.get("Idempotent-Replay") === "true");

    const conflict = await rawPost(
      key.fullKey,
      "/api/v1/memories/remember",
      { user_id: userId, content: "Something else entirely." },
      { "Idempotency-Key": idempotencyKey }
    );
    check("reusing a key with a different body is rejected", conflict.status === 409, await conflict.clone().json());

    console.log(`\n  ${failures === 0 ? "All checks passed" : `${failures} check(s) failed`}\n`);
  } finally {
    if (keep) {
      console.log(`  Kept org ${org.id} and key ${key.fullKey}\n`);
    } else {
      await db.delete(organizations).where(eq(organizations.id, org.id));
    }
  }

  if (failures > 0) throw new Error(`${failures} smoke check(s) failed`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error("\n", error);
    process.exit(1);
  }
);
