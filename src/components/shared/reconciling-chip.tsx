import { Loader, TriangleAlert } from "lucide-react";

/**
 * Writes are append-only: a memory is readable the moment it lands, before it
 * has been judged against its neighbours. Until that job runs, the row has no
 * version link and no contradiction flag — so say so rather than showing it as
 * a settled memory.
 */
export function ReconcilingChip({ status }: { status: "pending" | "running" | "failed" }) {
  const failed = status === "failed";
  const Icon = failed ? TriangleAlert : Loader;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        color: failed ? "var(--status-critical)" : "var(--muted-foreground)",
        backgroundColor: failed
          ? "color-mix(in oklab, var(--status-critical) 12%, transparent)"
          : "var(--muted)",
      }}
      title={
        failed
          ? "Reconciliation failed for this memory — it is stored, but unjudged."
          : "Queued for reconciliation: not yet compared against existing memories."
      }
    >
      <Icon className={`size-3${failed ? "" : " animate-spin [animation-duration:3s]"}`} />
      {failed ? "Unreconciled" : "Reconciling"}
    </span>
  );
}
