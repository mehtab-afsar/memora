import Link from "next/link";
import { auth } from "@/features/auth/lib/auth";
import { previewInvitation } from "@/lib/team";
import { AcceptInvitation } from "@/features/team/components/accept-invitation";

/**
 * The invitation landing page.
 *
 * This page **reads** the invitation and renders it. It never accepts it. That
 * separation is the entire design: corporate mail scanners fetch links in email
 * before a human ever clicks, so an invitation consumed by a GET is one
 * routinely burned by a security appliance, leaving the recipient with "this
 * link has already been used". Accepting happens on submit, from
 * `acceptInvitationAction`.
 *
 * (The reference implementation this borrows from solves the same problem by
 * decoding a JWT out of the URL fragment client-side, so the token never
 * reaches a server on load. That works, but it is a workaround for auth-provider
 * links; when we own the route, GET-reads-POST-writes says the same thing with
 * no cleverness.)
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invitation, session] = await Promise.all([previewInvitation(token), auth()]);

  if (!invitation) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold text-foreground">This invitation isn&apos;t valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been revoked, already used, or expired. Ask whoever invited you to send a new
          one.
        </p>
        <Link href="/" className="mt-5 inline-block text-sm text-primary underline">
          Go to Memora
        </Link>
      </Shell>
    );
  }

  const signedInAs = session?.user?.email ?? null;
  const emailMatches = signedInAs?.toLowerCase() === invitation.email;

  return (
    <Shell>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">You&apos;ve been invited</p>
      <h1 className="mt-2 text-lg font-semibold text-foreground">
        Join {invitation.orgName} on Memora
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {invitation.invitedByEmail ? `${invitation.invitedByEmail} invited ` : "Invitation sent to "}
        <span className="text-foreground">{invitation.email}</span> as{" "}
        {invitation.role === "admin" ? "an" : "a"} <span className="text-foreground">{invitation.role}</span>.
      </p>

      {!signedInAs ? (
        <div className="mt-5 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Sign in as {invitation.email} to accept.
          </p>
          <div className="flex gap-2">
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              Sign in
            </Link>
            <Link
              href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(invitation.email)}`}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground"
            >
              Create an account
            </Link>
          </div>
        </div>
      ) : emailMatches ? (
        <AcceptInvitation token={token} orgName={invitation.orgName} />
      ) : (
        <div className="mt-5 rounded-md border border-border bg-muted/40 p-3">
          <p className="text-sm text-foreground">
            You&apos;re signed in as {signedInAs}, but this invitation was sent to{" "}
            {invitation.email}.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign out and sign back in with that address to accept it.
          </p>
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Expires {invitation.expiresAt.toLocaleDateString()}. Nothing happens until you accept.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">{children}</div>
    </main>
  );
}
