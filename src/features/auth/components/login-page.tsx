"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Mail, Lock } from "lucide-react";
import { loginAction, googleSignInAction, type LoginState } from "@/features/auth/actions/login";
import { BrandMark } from "@/components/brand-mark";
import { GoogleIcon } from "@/components/google-icon";
import { PrimaryButton, GhostButton } from "@/features/landing/components/home/buttons";
import { hanken, dmMono, HOME_VARS } from "@/features/landing/lib/home-tokens";

const initialState: LoginState = {};

const FIELD_ICON_CLASS =
  "pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--muted)]";
const FIELD_INPUT_CLASS =
  "w-full rounded-lg border border-[var(--line)] bg-white py-2.5 pr-3.5 pl-10 text-base text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--indigo)]";
const FIELD_LABEL_CLASS = "text-sm font-medium text-[var(--ink)]";

export function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

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
          <Link href="/signup" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]">
            Sign up
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
        <div className="flex flex-col gap-2.5 text-center">
          <h1 className="text-[32px] leading-[1.1] font-medium tracking-[-0.03em]">Log in</h1>
          <p className="text-base text-[var(--ink-2)]">Pick up right where your agents left off.</p>
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
                  autoComplete="current-password"
                  className={FIELD_INPUT_CLASS}
                />
              </div>
            </div>
            <div className="-mt-2 text-right">
              <Link href="/forgot-password" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--indigo)]">
                Forgot your password?
              </Link>
            </div>
            {state.error && <p className="text-sm font-medium text-red-600">{state.error}</p>}
            <PrimaryButton type="submit" disabled={pending} className="mt-1 w-full">
              {pending ? "Logging in..." : "Log in"}
            </PrimaryButton>
          </form>
        </div>

        <p className="text-center text-sm text-[var(--ink-2)]">
          No account yet?{" "}
          <Link href="/signup" className="font-medium text-[var(--indigo)] hover:underline">
            Sign up
          </Link>
        </p>
      </main>
    </div>
  );
}
