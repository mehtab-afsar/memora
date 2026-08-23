import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/features/auth/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * The signed-in user, or null.
 *
 * Sessions are JWT-only (Auth.js's Credentials provider doesn't support DB
 * sessions), so a signed cookie stays "valid" long after its user row is gone —
 * a database wipe during development, a deleted account, or pointing the app at
 * a different database. Trusting the token alone means the app believes someone
 * is signed in as a user who does not exist, which surfaces later as a
 * foreign-key error or, worse, as a redirect loop that hides the public site.
 *
 * So the row is checked, and a cookie that names nobody counts as signed out.
 */
export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    return user ? session.user : null;
  } catch {
    // A transient database hiccup shouldn't crash every page behind auth —
    // treat it the same as a genuinely stale session. If the database is
    // really down, the next real query the page makes will say so clearly,
    // rather than this check turning it into a raw stack trace.
    return null;
  }
}

/** As `currentUser`, but sends anyone not signed in to the login page. */
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
