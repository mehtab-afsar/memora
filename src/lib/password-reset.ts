import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { validatePassword } from "@/lib/password-rules";

export { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/password-rules";

/**
 * Password resets.
 *
 * A reset link is a bearer credential for somebody's entire account, so it is
 * short-lived, single-use, hashed at rest, and it invalidates every other
 * outstanding reset for that user when redeemed.
 */

/** An hour. Long enough to find the email, short enough that a stale inbox is not a standing key. */
export const RESET_TTL_MINUTES = 60;

/** How many resets one account may request in the window below. */
const MAX_REQUESTS = 5;
const RATE_WINDOW_MINUTES = 15;

export class PasswordResetError extends Error {}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Issues a reset token, or returns null when the address has no account.
 *
 * Null rather than an error on purpose. The caller must respond identically
 * either way: a form that says "no account with that email" is a free tool for
 * checking which addresses are registered, which matters to anyone whose
 * membership of a service is sensitive. The difference belongs in whether an
 * email is sent, never in what the page says.
 */
export async function requestPasswordReset(email: string): Promise<{ token: string; userId: string } | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);
  if (!user) return null;

  // Without this, the form is a way to send someone an unlimited number of
  // emails they did not ask for, from our domain.
  const [recent] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.userId, user.id),
        gt(passwordResets.createdAt, sql`now() - (${RATE_WINDOW_MINUTES} * interval '1 minute')`)
      )
    );
  if ((recent?.total ?? 0) >= MAX_REQUESTS) {
    throw new PasswordResetError("Too many reset requests. Try again in a few minutes.");
  }

  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResets).values({
    userId: user.id,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
  });

  return { token, userId: user.id };
}

/**
 * Checks a token without spending it, so the reset page can render a form or an
 * explanation. Same GET-reads / POST-writes split as invitations: a link that a
 * mail scanner can consume is a link the recipient finds already used.
 */
export async function previewPasswordReset(token: string): Promise<{ email: string } | null> {
  const [row] = await db
    .select({ email: users.email, usedAt: passwordResets.usedAt, expiresAt: passwordResets.expiresAt })
    .from(passwordResets)
    .innerJoin(users, eq(passwordResets.userId, users.id))
    .where(eq(passwordResets.tokenHash, hashResetToken(token)))
    .limit(1);

  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
  return { email: row.email };
}

/** Redeems a token and sets the new password. */
export async function completePasswordReset(params: {
  token: string;
  password: string;
}): Promise<{ email: string }> {
  const problem = validatePassword(params.password);
  if (problem) throw new PasswordResetError(problem);

  const tokenHash = hashResetToken(params.token);

  return db.transaction(async (tx) => {
    const [reset] = await tx
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.tokenHash, tokenHash))
      .limit(1);

    if (!reset) throw new PasswordResetError("This reset link is not valid.");
    if (reset.usedAt) throw new PasswordResetError("This reset link has already been used.");
    if (reset.expiresAt.getTime() < Date.now()) {
      throw new PasswordResetError("This reset link has expired. Request a new one.");
    }

    // Conditional on still being unused, so two simultaneous submissions cannot
    // both succeed.
    const [claimed] = await tx
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResets.id, reset.id), isNull(passwordResets.usedAt)))
      .returning({ id: passwordResets.id });
    if (!claimed) throw new PasswordResetError("This reset link has already been used.");

    // Every other outstanding reset for this account dies too. Someone
    // resetting a password may be doing it because they think the account is
    // compromised, and leaving a second live link open would defeat that.
    await tx
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResets.userId, reset.userId), isNull(passwordResets.usedAt)));

    const [user] = await tx
      .update(users)
      .set({ passwordHash: hashPassword(params.password) })
      .where(eq(users.id, reset.userId))
      .returning({ email: users.email });

    return { email: user.email };
  });
}

/** Most recent reset for an account — used by tests and the smoke script. */
export async function latestResetFor(userId: string) {
  const [row] = await db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.userId, userId))
    .orderBy(desc(passwordResets.createdAt))
    .limit(1);
  return row ?? null;
}
