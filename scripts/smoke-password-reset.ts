import { loadEnv, requireEnv } from "../evals/env";

/**
 * Exercises password reset against a real database.
 *
 *   pnpm smoke:password-reset
 *
 * A reset link is a bearer credential for somebody's entire account, so the
 * claims worth checking are the ones that would let it be reused, guessed, or
 * survive longer than it should — and they are transactional, so a mock cannot
 * demonstrate them.
 */

async function main() {
  loadEnv();
  requireEnv("DATABASE_URL");

  const { eq, like, sql } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const { users, passwordResets } = await import("@/db/schema");
  const { hashPassword, verifyPassword } = await import("@/lib/password");
  const reset = await import("@/lib/password-reset");

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
  const email = `reset-${stamp}@example.com`;
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash: hashPassword("original-password") })
    .returning();

  try {
    console.log(`\nPassword reset smoke test on ${new URL(process.env.DATABASE_URL!).hostname}\n`);

    // An address with no account must be indistinguishable from one that has —
    // otherwise the form tells anyone who asks who is registered here.
    const unknown = await reset.requestPasswordReset(`nobody-${stamp}@example.com`);
    check("an unknown address yields no token, without erroring", unknown === null);

    const issued = await reset.requestPasswordReset(email);
    check("a known address yields a token", Boolean(issued?.token));

    const stored = await reset.latestResetFor(user.id);
    check("the raw token is not stored", !JSON.stringify(stored).includes(issued!.token));

    const preview = await reset.previewPasswordReset(issued!.token);
    check("previewing shows whose account it is", preview?.email === email);
    const afterPreview = await reset.latestResetFor(user.id);
    // The reason the reset page is a GET and the change is a POST.
    check("previewing does NOT consume it", afterPreview?.usedAt === null);

    await expectError(
      "a short password is refused",
      () => reset.completePasswordReset({ token: issued!.token, password: "short" }),
      "at least"
    );
    const stillUnused = await reset.latestResetFor(user.id);
    check("a refused attempt does not burn the token", stillUnused?.usedAt === null);

    // A second outstanding reset, to prove redeeming one kills the others.
    const second = await reset.requestPasswordReset(email);
    check("a second reset can be requested", Boolean(second?.token));

    const results = await Promise.allSettled([
      reset.completePasswordReset({ token: issued!.token, password: "a-brand-new-password" }),
      reset.completePasswordReset({ token: issued!.token, password: "a-different-password" }),
    ]);
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    check("two simultaneous submissions produce exactly one change", succeeded === 1, `${succeeded}`);

    const [after] = await db.select().from(users).where(eq(users.id, user.id));
    check("the new password works", verifyPassword("a-brand-new-password", after.passwordHash));
    check("the old password does not", !verifyPassword("original-password", after.passwordHash));

    await expectError(
      "a spent token cannot be reused",
      () => reset.completePasswordReset({ token: issued!.token, password: "yet-another-password" }),
      "already been used"
    );

    // Someone resetting a password may believe the account is compromised;
    // leaving a second live link open would defeat the point.
    check(
      "every other outstanding reset is invalidated",
      (await reset.previewPasswordReset(second!.token)) === null
    );

    // --- expiry ---------------------------------------------------------------
    const third = await reset.requestPasswordReset(email);
    await db
      .update(passwordResets)
      .set({ expiresAt: sql`now() - interval '1 minute'` })
      .where(eq(passwordResets.tokenHash, reset.hashResetToken(third!.token)));
    check("an expired link does not preview", (await reset.previewPasswordReset(third!.token)) === null);
    await expectError(
      "an expired link cannot be redeemed",
      () => reset.completePasswordReset({ token: third!.token, password: "expired-attempt-pw" }),
      "expired"
    );

    // --- rate limiting --------------------------------------------------------
    await expectError(
      "requests are rate limited",
      async () => {
        for (let i = 0; i < 8; i++) await reset.requestPasswordReset(email);
      },
      "too many"
    );

    // --- unknown token --------------------------------------------------------
    check("an invented token does not preview", (await reset.previewPasswordReset("not-a-real-token")) === null);
    await expectError(
      "an invented token cannot be redeemed",
      () => reset.completePasswordReset({ token: "not-a-real-token", password: "invented-token-pw" }),
      "not valid"
    );
  } finally {
    await db.delete(users).where(like(users.email, `%-${stamp}@example.com`));
  }

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
