"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Copy, Mail } from "lucide-react";
import {
  requestPasswordResetAction,
  type ResetRequestState,
} from "@/features/auth/actions/password-reset";
import {
  AuthShell,
  FIELD_ICON_CLASS,
  FIELD_INPUT_CLASS,
  FIELD_LABEL_CLASS,
  SUBMIT_CLASS,
} from "@/features/auth/components/auth-shell";

const initialState: ResetRequestState = {};

export function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);
  const [copied, setCopied] = useState(false);

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Forgot your password"
      subtitle="We'll email you a link to choose a new one."
      headerLink={{ href: "/login", label: "Log in" }}
      footer={
        <p className="text-center text-sm text-[var(--lp-text-secondary)]">
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-[var(--lp-accent)] hover:underline">
            Log in
          </Link>
        </p>
      }
    >
      {state.sent ? (
        <div className="flex flex-col gap-3">
          {/* Deliberately identical whether or not the address has an account.
              Saying "no account with that email" turns this form into a way to
              check who is registered. */}
          <p className="text-base text-[var(--lp-text)]">
            If that address has an account, a reset link is on its way.
          </p>
          <p className="text-sm text-[var(--lp-text-secondary)]">
            The link works once and expires in an hour. Check spam if it hasn&apos;t arrived.
          </p>

          {state.link && (
            <div className="mt-2 flex flex-col gap-2 rounded-md border-2 border-[var(--lp-border)] p-3">
              <p className="text-xs text-[var(--lp-text-secondary)]">
                {state.notice} Use this link directly:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate font-mono text-xs text-[var(--lp-text-secondary)]">
                  {state.link}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(state.link!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border-2 border-[var(--lp-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--lp-text)]"
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className={FIELD_LABEL_CLASS}>
              Email
            </label>
            <div className="relative">
              <Mail className={FIELD_ICON_CLASS} />
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className={FIELD_INPUT_CLASS}
              />
            </div>
          </div>
          {state.error && <p className="text-sm font-medium text-red-600">{state.error}</p>}
          <button type="submit" disabled={pending} className={SUBMIT_CLASS}>
            {pending ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
