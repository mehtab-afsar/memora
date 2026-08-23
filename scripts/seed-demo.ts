import { loadEnv, requireEnv } from "../evals/env";

/**
 * Seeds the demo end-user into a project environment.
 *
 *   pnpm seed:demo                          # lists environments, seeds nothing
 *   pnpm seed:demo <projectId> <envId>      # one specific environment
 *   pnpm seed:demo --all                    # every environment without it
 *
 * Onboarding does this automatically for new signups; this is for projects that
 * already existed, and for re-seeding after the demo data changes.
 */

async function main() {
  loadEnv();
  requireEnv("DATABASE_URL");

  const { and, eq } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const { environments, memories, projects } = await import("@/db/schema");
  const { seedDemoUser, DEMO_USER_ID } = await import("@/lib/demo-data");

  const argv = process.argv.slice(2);
  const all = argv.includes("--all");
  const [projectId, environmentId] = argv.filter((arg) => !arg.startsWith("--"));

  const targets: { projectId: string; environmentId: string; label: string }[] = [];

  if (projectId && environmentId) {
    targets.push({ projectId, environmentId, label: `${projectId}/${environmentId}` });
  } else {
    const rows = await db
      .select({
        projectId: projects.id,
        projectName: projects.name,
        environmentId: environments.id,
        environmentName: environments.name,
      })
      .from(environments)
      .innerJoin(projects, eq(environments.projectId, projects.id));

    for (const row of rows) {
      const [existing] = await db
        .select({ id: memories.id })
        .from(memories)
        .where(
          and(
            eq(memories.projectId, row.projectId),
            eq(memories.environmentId, row.environmentId),
            eq(memories.endUserId, DEMO_USER_ID)
          )
        )
        .limit(1);
      if (existing) continue;
      targets.push({
        projectId: row.projectId,
        environmentId: row.environmentId,
        label: `${row.projectName} / ${row.environmentName}`,
      });
    }
  }

  if (targets.length === 0) {
    console.log("\nNothing to seed — every environment already has the demo user.\n");
    return;
  }

  // Seeding is a write into someone's real project, and each one costs a Voyage
  // request — three a minute on the free tier. Listing by default rather than
  // seeding means running this with no arguments cannot surprise anyone.
  if (!all) {
    console.log(`\n${targets.length} environment(s) without the demo user:\n`);
    for (const target of targets) {
      console.log(`  ${target.label}\n    pnpm seed:demo ${target.projectId} ${target.environmentId}`);
    }
    console.log(`\nPass --all to seed every one of them.\n`);
    return;
  }

  console.log(`\nSeeding ${targets.length} environment(s)\n`);
  for (const target of targets) {
    const result = await seedDemoUser(target);
    console.log(
      `  ${target.label} — ${result.memories} memories` +
        (result.embedded ? "" : "  (no embeddings: Voyage unavailable, keyword recall only)")
    );
  }
  console.log();
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
