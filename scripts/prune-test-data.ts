import { loadEnv, requireEnv } from "../evals/env";

/**
 * Removes accounts and organizations left behind by verification runs.
 *
 *   pnpm prune:test-data            # shows what it would delete
 *   pnpm prune:test-data --apply    # deletes it
 *
 * Automated checks create throwaway signups, and the ones that fail partway
 * leave the account behind. They accumulate quietly, and on a shared database
 * they make it genuinely hard to tell whose data is whose.
 *
 * Two rules, both conservative:
 *
 *   1. Accounts at example.com. Reserved by RFC 2606 precisely so it can never
 *      be a real address, which makes it the one domain safe to delete by
 *      pattern.
 *   2. Organizations nobody is a member of. Once an account goes, the orgs it
 *      alone belonged to are unreachable — no one can log in and see them, and
 *      no API key survives the cascade. They are only taking up space.
 *
 * Anything with a real member is left alone, whatever it contains.
 */

async function main() {
  loadEnv();
  requireEnv("DATABASE_URL");

  const apply = process.argv.includes("--apply");
  const { eq, like, sql } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const { organizations, memberships, users, memories, projects } = await import("@/db/schema");

  const host = new URL(process.env.DATABASE_URL!).hostname;
  console.log(`\n${apply ? "Pruning" : "Would prune"} ${host}\n`);

  const testUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(like(users.email, "%@example.com"));

  console.log(`Test accounts (${testUsers.length}):`);
  for (const user of testUsers) console.log(`  ${user.email}`);

  if (apply) {
    for (const user of testUsers) await db.delete(users).where(eq(users.id, user.id));
  }

  // Recomputed after the deletions above, because removing an account is
  // usually what strands the organization in the first place.
  const orphanRows = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(
      sql`not exists (select 1 from ${memberships} where ${memberships.orgId} = ${organizations.id})`
    );

  // Counted with a plain join rather than a correlated subquery: drizzle
  // renders bare column names, and `organizations.id` in the outer scope makes
  // an inner `id` ambiguous (Postgres 42702).
  const countsByOrg = new Map<string, number>(
    (
      await db
        .select({ orgId: projects.orgId, total: sql<number>`count(${memories.id})::int` })
        .from(projects)
        .leftJoin(memories, eq(memories.projectId, projects.id))
        .groupBy(projects.orgId)
    ).map((row) => [row.orgId, row.total])
  );

  const orphans = orphanRows.map((org) => ({ ...org, memories: countsByOrg.get(org.id) ?? 0 }));

  console.log(`\nOrganizations with no members (${orphans.length}):`);
  for (const org of orphans) {
    console.log(`  ${org.name}  —  ${org.memories} memories  ${org.id}`);
  }

  if (apply) {
    for (const org of orphans) await db.delete(organizations).where(eq(organizations.id, org.id));
  }

  const [remaining] = await db.select({ total: sql<number>`count(*)::int` }).from(organizations);
  const [remainingUsers] = await db.select({ total: sql<number>`count(*)::int` }).from(users);

  console.log(
    apply
      ? `\nDone. ${remainingUsers.total} account(s) and ${remaining.total} organization(s) remain.\n`
      : `\nNothing was deleted. Pass --apply to do it.\n`
  );
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
