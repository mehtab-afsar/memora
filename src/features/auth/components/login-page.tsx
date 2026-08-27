"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Mail, Lock } from "lucide-react";
import { loginAction, googleSignInAction, type LoginState } from "@/features/auth/actions/login";
import { BrandMark } from "@/components/brand-mark";
import { GoogleIcon } from "@/components/google-icon";
import { lpSans, lpMono, LP_VARS, Eyebrow } from "@/features/landing/lib/lp-theme";

const initialState: LoginState = {};

const FIELD_ICON_CLASS = "pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--lp-text-tertiary)]";
const FIELD_INPUT_CLASS =
  "w-full rounded-md border-2 border-[var(--lp-border)] bg-[var(--lp-bg)] py-2.5 pr-3.5 pl-10 text-base text-[var(--lp-text)] outline-none transition-colors placeholder:text-[var(--lp-text-tertiary)] focus:border-[var(--lp-accent)]";
const FIELD_LABEL_CLASS = "text-sm font-semibold text-[var(--lp-text)]";

export function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div
      className={`${lpSans.variable} ${lpMono.variable} flex min-h-screen flex-col bg-[var(--lp-bg)]`}
      style={{ ...LP_VARS, fontFamily: "var(--font-lp-sans)" }}
    >
      <header className="border-b border-[var(--lp-border)]">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 text-[var(--lp-text)]">
            <BrandMark className="size-6" />
            <span className="text-base font-bold tracking-tight">MEMORA</span>
          </Link>
          <Link href="/signup" className="text-sm font-semibold text-[var(--lp-text-secondary)] hover:text-[var(--lp-text)]">
            Sign up
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
        <div className="flex flex-col gap-3 text-center">
          <Eyebrow>Welcome back</Eyebrow>
          <h1 className="text-4xl leading-[1.05] font-bold tracking-tighter text-[var(--lp-text)]">Log in</h1>
          <p className="text-base leading-relaxed text-[var(--lp-text-secondary)]">
            Pick up right where your agents left off.
          </p>
        </div>

        <div className="rounded-lg border-2 border-[var(--lp-border)] bg-[var(--lp-bg)] p-8">
          <form action={googleSignInAction}>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-md border-2 border-[var(--lp-border)] bg-[var(--lp-bg)] px-6 py-3 text-base font-semibold text-[var(--lp-text)] transition-colors hover:bg-[var(--lp-border)]/20"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--lp-border)]" />
            <span className="text-xs font-semibold text-[var(--lp-text-tertiary)]">OR</span>
            <div className="h-px flex-1 bg-[var(--lp-border)]" />
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
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-[var(--lp-text-secondary)] hover:text-[var(--lp-accent)]"
              >
                Forgot your password?
              </Link>
            </div>
            {state.error && <p className="text-sm font-medium text-red-600">{state.error}</p>}
            <button
              type="submit"
              disabled={pending}
              className="mt-1 inline-flex items-center justify-center rounded-md bg-[var(--lp-accent)] px-6 py-3.5 text-base font-semibold text-white transition-transform hover:-translate-y-0.5 hover:opacity-90 disabled:pointer-events-none disabled:opacity-60 disabled:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-accent)]"
            >
              {pending ? "Logging in..." : "Log in"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[var(--lp-text-secondary)]">
          No account yet?{" "}
          <Link href="/signup" className="font-semibold text-[var(--lp-accent)] hover:underline">
            Sign up
          </Link>
        </p>
      </main>
    </div>
  );
}
