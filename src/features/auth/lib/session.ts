import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/features/auth/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Sessions are JWT-only (Auth.js Credentials provider doesn't support DB
 * sessions), so a signed cookie stays "valid" even after its user row is
 * gone — e.g. a DB wipe during development. Verify the user still exists on
 * every request rather than trusting the token, so a stale cookie sends
 * someone back to login instead of a foreign-key error deeper in the app.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  let userExists = false;
  try {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, session.user.id)).limit(1);
    userExists = Boolean(user);
  } catch {
    // A transient DB hiccup here shouldn't crash every page behind auth —
    // fail the same way a genuinely stale session does. If the database is
    // actually down, the next real query the page makes will surface that
    // clearly, rather than this check turning it into a raw stack trace.
  }

  if (!userExists) {
    redirect("/login");
  }

  return session.user;
}
