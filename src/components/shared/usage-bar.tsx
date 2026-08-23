export function UsageBar({ label, used, quota }: { label: string; used: number; quota: number | null }) {
  const pct = quota === null ? 0 : Math.min(100, Math.round((used / quota) * 100));
  // Amber at 80% rather than only red at 100%: a customer should find out they
  // are running out before the API starts refusing them, not after.
  const color = pct >= 100 ? "var(--status-critical)" : pct >= 80 ? "var(--status-warning)" : "var(--primary)";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-xs tabular-nums text-foreground">
          {used.toLocaleString()} {quota === null ? "" : `/ ${quota.toLocaleString()}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
