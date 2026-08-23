import { lpSans, lpMono, LP_VARS } from "@/features/landing/lib/lp-theme";

/** Wraps every marketing page in the same fixed font/palette setup — written once instead of per page. */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${lpSans.variable} ${lpMono.variable} min-h-screen bg-[var(--lp-bg)]`}
      style={{ ...LP_VARS, fontFamily: "var(--font-lp-sans)" }}
    >
      {children}
    </div>
  );
}
