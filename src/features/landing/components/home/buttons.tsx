import { cn } from "@/lib/utils";

/**
 * Shared by every page on the new home-tokens design (home, onboarding,
 * login, signup) — written once here instead of redefined locally per page,
 * which is what happened the first two times this look got reused.
 */
export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--ink)] px-6 py-3 text-[15px] font-medium text-white transition-colors hover:bg-[#0f0f14] disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] px-5 py-3 text-[15px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--paper-2)]",
        className
      )}
    >
      {children}
    </button>
  );
}
