import { loadEnv, requireEnv } from "../evals/env";

/**
 * Exercises environment rename/delete against a real database — specifically
 * the guard that refuses to delete a project's last remaining environment,
 * which the rest of the product assumes always exists somewhere to put a new
 * API key.
 *
 *   pnpm smoke:environments
 */

async function main() {
  loadEnv();
  requireEnv("DATABASE_URL");

  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const { organizations, users } = await import("@/db/schema");
  const org = await import("@/lib/org");

  let failures = 0;
  const check = (label: string, ok: boolean, detail = "") => {
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
  };

  const expectError = async (label: string, fn: () => Promise<unknown>, fragment: string) => {
    try {
      await fn();
      check(label, false, "no error was thrown");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      check(label, message.toLowerCase().includes(fragment.toLowerCase()), message);
    }
  };

  const stamp = Date.now();
  const [user] = await db
    .insert(users)
    .values({ email: `envsmoke-${stamp}@example.com`, passwordHash: "x", name: "Env Smoke" })
    .returning();

  const { org: created, project } = await org.createOrgWithProject(user.id, `env-smoke-${stamp}`, "Default");

  try {
    console.log(`\nEnvironments smoke test on ${new URL(process.env.DATABASE_URL!).hostname}\n`);

    const initial = await org.getEnvironmentsForProject(project.id);
    check("onboarding created exactly one environment", initial.length === 1, `${initial.length}`);

    await expectError(
      "the only environment cannot be deleted",
      () => org.deleteEnvironment(initial[0].id, project.id),
      "only environment"
    );

    const second = await org.createEnvironment(project.id, "staging");
    const renamed = await org.renameEnvironment(second.id, project.id, "preview");
    check("renaming an environment persists", renamed?.name === "preview");

    await org.deleteEnvironment(second.id, project.id);
    const afterDelete = await org.getEnvironmentsForProject(project.id);
    check("deleting a non-last environment succeeds", afterDelete.length === 1, `${afterDelete.length}`);
  } finally {
    await db.delete(organizations).where(eq(organizations.id, created.id));
    await db.delete(users).where(eq(users.id, user.id));
  }

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
