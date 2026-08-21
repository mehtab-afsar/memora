import { loadEnv, requireEnv } from "../evals/env";

/**
 * Proves erasure actually erases, against a real database.
 *
 *   pnpm smoke:erasure
 *
 * Worth a script rather than a unit test. The claim erasure makes is not "we
 * called delete" — it is that after the call, nothing about the subject remains
 * anywhere: no memory row, no evidence excerpt in the subject's own words, no
 * embedding, no pending reconciliation job, no derived profile. All of that is
 * enforced by foreign keys in the schema, so the only honest way to check it is
 * to put a subject in a real Postgres, erase them, and count what is left.
 *
 * Provisions and removes its own throwaway org.
 */

async function main() {
  loadEnv();
  requireEnv("DATABASE_URL");

  const { and, eq, sql } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const {
    organizations,
    projects,
    environments,
    memories,
    memoryEvidence,
    reconciliationJobs,
    contradictions,
    userProfiles,
    erasureRecords,
  } = await import("@/db/schema");
  const { eraseUser, exportUser, subjectHash } = await import("@/lib/erasure");

  const stamp = new Date().toISOString();
  const [org] = await db.insert(organizations).values({ name: `erasure-${stamp}` }).returning();
  const [project] = await db.insert(projects).values({ orgId: org.id, name: "erasure" }).returning();
  const [environment] = await db
    .insert(environments)
    .values({ projectId: project.id, name: "development" })
    .returning();

  const scope = { projectId: project.id, environmentId: environment.id, endUserId: "subject-under-test" };
  // A second user in the same environment, to catch the failure that matters
  // most: an erasure whose WHERE clause is too broad.
  const bystander = { ...scope, endUserId: "bystander" };

  let failures = 0;
  const check = (label: string, ok: boolean, detail = "") => {
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
  };

  try {
    const seed = async (userScope: typeof scope, content: string) => {
      const [memory] = await db
        .insert(memories)
        .values({
          projectId: userScope.projectId,
          environmentId: userScope.environmentId,
          endUserId: userScope.endUserId,
          content,
          type: "fact",
          confidence: 0.9,
          importance: 0.5,
          sourceType: "smoke",
          // A non-null embedding on purpose: an embedding is derived from the
          // content and partially invertible, so one left behind is personal
          // data left behind.
          embedding: Array.from({ length: 1024 }, () => 0.01),
        })
        .returning();

      await db.insert(memoryEvidence).values({
        memoryId: memory.id,
        sourceType: "smoke",
        excerpt: `the subject's own words: ${content}`,
        eventType: "extracted",
      });

      await db.insert(reconciliationJobs).values({
        memoryId: memory.id,
        projectId: userScope.projectId,
        environmentId: userScope.environmentId,
        endUserId: userScope.endUserId,
      });

      return memory;
    };

    const a = await seed(scope, "lives in Lisbon");
    const b = await seed(scope, "lives in Porto");
    await seed(bystander, "unrelated fact about someone else");

    await db.insert(contradictions).values({
      projectId: project.id,
      memoryIdA: a.id,
      memoryIdB: b.id,
      reasoning: "cannot live in both",
    });

    await db.insert(userProfiles).values({
      projectId: project.id,
      environmentId: environment.id,
      endUserId: scope.endUserId,
      content: "A person who lives in Portugal.",
      sourceMemoryIds: [a.id, b.id],
      memoryCount: 2,
    });

    console.log(`\nErasure smoke test on ${new URL(process.env.DATABASE_URL!).hostname}\n`);

    // --- export, before anything is destroyed ---------------------------------
    const exported = await exportUser(scope);
    check("export returns every memory held", exported.memories.length === 2, `${exported.memories.length}`);
    check("export includes the source excerpts", exported.memories.every((m) => m.evidence.length === 1));
    check("export includes the derived profile", exported.profile !== null);
    check(
      "export is scoped to one subject",
      !JSON.stringify(exported).includes("unrelated fact about someone else")
    );

    // --- erase ----------------------------------------------------------------
    const result = await eraseUser(scope, "api");
    check("erase reports what it destroyed", result.memoriesErased === 2 && result.profilesErased === 1,
      `${result.memoriesErased} memories, ${result.profilesErased} profile`);

    const remaining = async (label: string, query: Promise<{ count: number }[]>) => {
      const [row] = await query;
      check(`no ${label} remain`, row.count === 0, `${row.count} left`);
    };

    await remaining("memories", db
      .select({ count: sql<number>`count(*)::int` })
      .from(memories)
      .where(and(eq(memories.projectId, project.id), eq(memories.endUserId, scope.endUserId))));

    await remaining("evidence excerpts", db
      .select({ count: sql<number>`count(*)::int` })
      .from(memoryEvidence)
      .where(sql`${memoryEvidence.memoryId} in (${a.id}::uuid, ${b.id}::uuid)`));

    await remaining("reconciliation jobs", db
      .select({ count: sql<number>`count(*)::int` })
      .from(reconciliationJobs)
      .where(and(eq(reconciliationJobs.projectId, project.id), eq(reconciliationJobs.endUserId, scope.endUserId))));

    await remaining("contradictions", db
      .select({ count: sql<number>`count(*)::int` })
      .from(contradictions)
      .where(eq(contradictions.projectId, project.id)));

    await remaining("profiles", db
      .select({ count: sql<number>`count(*)::int` })
      .from(userProfiles)
      .where(and(eq(userProfiles.projectId, project.id), eq(userProfiles.endUserId, scope.endUserId))));

    // --- the bystander --------------------------------------------------------
    const [survivor] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(memories)
      .where(and(eq(memories.projectId, project.id), eq(memories.endUserId, bystander.endUserId)));
    check("another user in the same environment is untouched", survivor.count === 1, `${survivor.count} left`);

    // --- the log --------------------------------------------------------------
    const [record] = await db
      .select()
      .from(erasureRecords)
      .where(eq(erasureRecords.projectId, project.id));
    check("an erasure record was written", Boolean(record));
    check("the record proves this subject", record?.subjectHash === subjectHash(scope));
    check("the record does not contain the identifier", !JSON.stringify(record).includes(scope.endUserId));

    // --- idempotence ----------------------------------------------------------
    const again = await eraseUser(scope, "api");
    check("erasing an already-erased subject is a no-op", again.memoriesErased === 0);
  } finally {
    await db.delete(organizations).where(eq(organizations.id, org.id));
  }

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
