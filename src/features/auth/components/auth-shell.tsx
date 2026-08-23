"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { lpSans, lpMono, LP_VARS, Eyebrow } from "@/features/landing/lib/lp-theme";

/**
 * The frame the login and signup pages already used, extracted so the password
 * reset pages look like the rest of the account flow rather than like the
 * dashboard they are not part of yet.
 */
export const FIELD_ICON_CLASS =
  "pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--lp-text-tertiary)]";
export const FIELD_INPUT_CLASS =
  "w-full rounded-md border-2 border-[var(--lp-border)] bg-[var(--lp-bg)] py-2.5 pr-3.5 pl-10 text-base text-[var(--lp-text)] outline-none transition-colors placeholder:text-[var(--lp-text-tertiary)] focus:border-[var(--lp-accent)]";
export const FIELD_LABEL_CLASS = "text-sm font-semibold text-[var(--lp-text)]";
export const SUBMIT_CLASS =
  "mt-1 inline-flex items-center justify-center rounded-md bg-[var(--lp-accent)] px-6 py-3.5 text-base font-semibold text-white transition-transform hover:-translate-y-0.5 hover:opacity-90 disabled:pointer-events-none disabled:opacity-60 disabled:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-accent)]";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  headerLink,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  headerLink: { href: string; label: string };
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
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
          <Link
            href={headerLink.href}
            className="text-sm font-semibold text-[var(--lp-text-secondary)] hover:text-[var(--lp-text)]"
          >
            {headerLink.label}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
        <div className="flex flex-col gap-3 text-center">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="text-4xl leading-[1.05] font-bold tracking-tighter text-[var(--lp-text)]">
            {title}
          </h1>
          <p className="text-base leading-relaxed text-[var(--lp-text-secondary)]">{subtitle}</p>
        </div>

        <div className="rounded-lg border-2 border-[var(--lp-border)] bg-[var(--lp-bg)] p-8">{children}</div>

        {footer}
      </main>
    </div>
  );
}
