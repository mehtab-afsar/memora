"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GITHUB_URL } from "@/features/landing/lib/lp-theme";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-20 bg-white/88 backdrop-blur-md transition-[border-color] duration-150 ${
        scrolled ? "border-b border-[var(--line)]" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-[68px] max-w-[1120px] items-center justify-between px-7">
        <Link href="/" className="text-[17px] font-semibold tracking-[0.08em] text-[var(--ink)]">
          MEMORA
        </Link>
        <ul className="hidden items-center gap-7 text-[15px] text-[var(--ink-2)] min-[861px]:flex">
          <li>
            <Link href="/product" className="hover:text-[var(--ink)]">
              Product
            </Link>
          </li>
          <li>
            <Link href="/how-it-works" className="hover:text-[var(--ink)]">
              How it works
            </Link>
          </li>
          <li>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-[var(--ink)]">
              GitHub
            </a>
          </li>
        </ul>
        <div className="flex items-center gap-[22px] text-[15px]">
          <Link href="/login" className="hidden text-[var(--ink-2)] hover:text-[var(--ink)] min-[861px]:inline">
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-[var(--ink)] px-4 py-[9px] text-[14px] font-medium text-white transition-colors hover:bg-[#0f0f14]"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
