import { MEMORY_TYPE_COLOR_VAR, MEMORY_TYPE_LABELS, type MemoryType } from "@/lib/memory-types";

export function TypeBadge({ type }: { type: string }) {
  const t = type as MemoryType;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: MEMORY_TYPE_COLOR_VAR[t] ?? "var(--muted-foreground)" }} />
      {MEMORY_TYPE_LABELS[t] ?? type}
    </span>
  );
}
