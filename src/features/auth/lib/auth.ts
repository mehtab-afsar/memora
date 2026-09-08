import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  logger: {
    error(error) {
      // A JWT that fails to decode — signed under an old AUTH_SECRET, or from
      // before a database switch — is not a bug here. `currentUser()` already
      // treats a session `auth()` can't produce the same as signed out, so
      // logging this by default just prints a scary stack trace for a case
      // the app was specifically built to handle gracefully.
      if (error.name === "JWTSessionError") return;
      console.error(error);
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
        if (!user) return null;
        // Google-only accounts have no passwordHash — credentials login can't apply.
        if (!user.passwordHash) return null;
        if (!verifyPassword(password, user.passwordHash)) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
    Google,
  ],
  callbacks: {
    // There's no adapter (JWT-only sessions, per the schema.ts comment), so
    // Google sign-in has to resolve/create the `users` row by hand here —
    // same job an adapter's `getUserByAccount`/`createUser` would otherwise do.
    // Reassigning `user.id` to our DB id is what makes the `jwt` callback below
    // stamp the right id into the session.
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      if (!user.email) return false;

      const email = user.email.toLowerCase();
      let [dbUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!dbUser) {
        [dbUser] = await db.insert(users).values({ email, name: user.name ?? null }).returning();
      }
      user.id = dbUser.id;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === "string") {
        session.user.id = token.userId;
      }
      return session;
    },
  },
});
