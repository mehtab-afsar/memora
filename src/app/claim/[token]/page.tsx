import Link from "next/link";
import { currentUser } from "@/features/auth/lib/session";
import { previewOrgClaim } from "@/lib/org";
import { AcceptOrgClaim } from "@/features/onboarding/components/accept-org-claim";

/**
 * The agent-first claim landing page. Mirrors src/app/invite/[token]/page.tsx:
 * this page only reads the claim token and renders it — accepting happens on
 * submit, from `acceptOrgClaimAction`, so a link followed by an email
 * scanner or link-preview bot never burns it before a human sees it.
 *
 * Unlike a team invitation, a claim link isn't bound to an email address —
 * whoever is signed in when they submit becomes this org's owner, since
 * nothing sent this link to anyone in particular.
 */
export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [claim, user] = await Promise.all([previewOrgClaim(token), currentUser()]);

  if (!claim) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold text-foreground">This claim link isn&apos;t valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have already been claimed or expired. If an agent set this up for you, it can mint a
          fresh one with <code className="text-foreground">memora init --agent</code>.
        </p>
        <Link href="/" className="mt-5 inline-block text-sm text-primary underline">
          Go to Memora
        </Link>
      </Shell>
    );
  }

  const signedInAs = user?.email ?? null;

  return (
    <Shell>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Provisioned by an agent</p>
      <h1 className="mt-2 text-lg font-semibold text-foreground">
        Claim {claim.orgName} on Memora
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        An API key for this workspace is already live and working. Claiming it just makes you its owner —
        nothing about the key changes.
      </p>

      {!signedInAs ? (
        <div className="mt-5 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Sign in or create an account to claim it.</p>
          <div className="flex gap-2">
            <Link
              href={`/login?next=${encodeURIComponent(`/claim/${token}`)}`}
              className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              Sign in
            </Link>
            <Link
              href={`/signup?next=${encodeURIComponent(`/claim/${token}`)}`}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground"
            >
              Create an account
            </Link>
          </div>
        </div>
      ) : (
        <AcceptOrgClaim token={token} orgName={claim.orgName} />
      )}

      <p className="mt-6 text-xs text-muted-foreground">Nothing happens until you claim it.</p>
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
