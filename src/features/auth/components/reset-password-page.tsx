"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import {
  completePasswordResetAction,
  type ResetCompleteState,
} from "@/features/auth/actions/password-reset";
import {
  AuthShell,
  FIELD_ICON_CLASS,
  FIELD_INPUT_CLASS,
  FIELD_LABEL_CLASS,
  SUBMIT_CLASS,
} from "@/features/auth/components/auth-shell";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

const initialState: ResetCompleteState = {};

export function ResetPasswordPage({ token, email }: { token: string; email: string }) {
  const action = completePasswordResetAction.bind(null, token);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (state.done) {
    return (
      <AuthShell
        eyebrow="Account recovery"
        title="Password changed"
        subtitle="You can log in with your new password now."
        headerLink={{ href: "/login", label: "Log in" }}
      >
        <Link href="/login" className={`${SUBMIT_CLASS} w-full`}>
          Log in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Choose a new password"
      subtitle={`For ${email}.`}
      headerLink={{ href: "/login", label: "Log in" }}
    >
      <form action={formAction} className="flex flex-col gap-5">
        {/* Present but hidden, so password managers associate the new password
            with the right account instead of offering it everywhere. */}
        <input type="hidden" name="email" value={email} autoComplete="username" readOnly />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className={FIELD_LABEL_CLASS}>
            New password
          </label>
          <div className="relative">
            <Lock className={FIELD_ICON_CLASS} />
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className={FIELD_INPUT_CLASS}
            />
          </div>
          <p className="text-xs text-[var(--lp-text-secondary)]">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm" className={FIELD_LABEL_CLASS}>
            Confirm password
          </label>
          <div className="relative">
            <Lock className={FIELD_ICON_CLASS} />
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className={FIELD_INPUT_CLASS}
            />
          </div>
        </div>
        {state.error && <p className="text-sm font-medium text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending} className={SUBMIT_CLASS}>
          {pending ? "Saving..." : "Change password"}
        </button>
      </form>
    </AuthShell>
  );
}
