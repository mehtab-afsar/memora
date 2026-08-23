import type { Metadata } from "next";
import Link from "next/link";
import { previewPasswordReset } from "@/lib/password-reset";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ResetPasswordPage } from "@/features/auth/components/reset-password-page";

export const metadata: Metadata = { title: "Choose a new password — MEMORA" };

/**
 * Reads the token and renders a form; it never spends it. Same split as the
 * invitation page — a reset link consumed by a GET is one an email security
 * scanner burns before its owner ever clicks.
 */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reset = await previewPasswordReset(token);

  if (!reset) {
    return (
      <AuthShell
        eyebrow="Account recovery"
        title="This link isn't valid"
        subtitle="It may have expired, or already been used."
        headerLink={{ href: "/login", label: "Log in" }}
      >
        <Link
          href="/forgot-password"
          className="text-base font-semibold text-[var(--lp-accent)] hover:underline"
        >
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return <ResetPasswordPage token={token} email={reset.email} />;
}
