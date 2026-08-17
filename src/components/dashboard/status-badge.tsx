import { CircleCheck, Clock, Flag, History, Archive } from "lucide-react";
import { MEMORY_STATUS_LABELS, type MemoryStatus } from "@/lib/memory-types";

const STATUS_STYLE: Record<MemoryStatus, { icon: typeof CircleCheck; color: string; bg: string }> = {
  active: { icon: CircleCheck, color: "var(--status-good)", bg: "color-mix(in oklab, var(--status-good) 12%, transparent)" },
  stale: { icon: Clock, color: "var(--status-warning)", bg: "color-mix(in oklab, var(--status-warning) 16%, transparent)" },
  flagged: { icon: Flag, color: "var(--status-critical)", bg: "color-mix(in oklab, var(--status-critical) 12%, transparent)" },
  superseded: { icon: History, color: "var(--muted-foreground)", bg: "var(--muted)" },
  archived: { icon: Archive, color: "var(--muted-foreground)", bg: "var(--muted)" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = status as MemoryStatus;
  const style = STATUS_STYLE[s];
  if (!style) return <span className="text-xs text-muted-foreground">{status}</span>;

  const Icon = style.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: style.color, backgroundColor: style.bg }}
    >
      <Icon className="size-3" />
      {MEMORY_STATUS_LABELS[s]}
    </span>
  );
}
