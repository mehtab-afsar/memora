"use client";

import { useActionState } from "react";
import Link from "next/link";
import { User, Mail, Lock } from "lucide-react";
import { signupAction, type SignupState } from "@/features/auth/actions/signup";
import { googleSignInAction } from "@/features/auth/actions/login";
import { BrandMark } from "@/components/brand-mark";
import { GoogleIcon } from "@/components/google-icon";
import { PrimaryButton, GhostButton } from "@/features/landing/components/home/buttons";
import { hanken, dmMono, HOME_VARS } from "@/features/landing/lib/home-tokens";

const initialState: SignupState = {};

const FIELD_ICON_CLASS =
  "pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--muted)]";
const FIELD_INPUT_CLASS =
  "w-full rounded-lg border border-[var(--line)] bg-white py-2.5 pr-3.5 pl-10 text-base text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--indigo)]";
const FIELD_LABEL_CLASS = "text-sm font-medium text-[var(--ink)]";

export function SignupPage() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);

  return (
    <div
      className={`${hanken.variable} ${dmMono.variable} flex min-h-screen flex-col bg-white text-[var(--ink)]`}
      style={{ ...HOME_VARS, fontFamily: "var(--font-home-sans)" }}
    >
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark className="size-6 text-[var(--indigo)]" />
            <span className="text-[17px] font-semibold tracking-[0.08em] text-[var(--ink)]">MEMORA</span>
          </Link>
          <Link href="/login" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]">
            Log in
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
        <div className="flex flex-col gap-2.5 text-center">
          <h1 className="text-[32px] leading-[1.1] font-medium tracking-[-0.03em]">Create your account</h1>
          <p className="text-base text-[var(--ink-2)]">Start building agents with reliable memory.</p>
        </div>

        <div className="rounded-lg border border-[var(--line)] p-8">
          <form action={googleSignInAction}>
            <GhostButton type="submit" className="w-full">
              <GoogleIcon />
              Continue with Google
            </GhostButton>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--line)]" />
            <span className="text-xs font-medium text-[var(--muted)]">OR</span>
            <div className="h-px flex-1 bg-[var(--line)]" />
          </div>

          <form action={formAction} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className={FIELD_LABEL_CLASS}>
                Name
              </label>
              <div className="relative">
                <User className={FIELD_ICON_CLASS} />
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Optional"
                  className={FIELD_INPUT_CLASS}
                />
              </div>
            </div>
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
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className={FIELD_LABEL_CLASS}>
                Password
              </label>
              <div className="relative">
                <Lock className={FIELD_ICON_CLASS} />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className={FIELD_INPUT_CLASS}
                />
              </div>
            </div>
            {state.error && <p className="text-sm font-medium text-red-600">{state.error}</p>}
            <PrimaryButton type="submit" disabled={pending} className="mt-1 w-full">
              {pending ? "Creating account..." : "Create account"}
            </PrimaryButton>
          </form>
        </div>

        <p className="text-center text-sm text-[var(--ink-2)]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--indigo)] hover:underline">
            Log in
          </Link>
        </p>
      </main>
    </div>
  );
}
