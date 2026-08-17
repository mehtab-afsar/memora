"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type StatusKey = "active" | "stale" | "flagged" | "superseded" | "archived";

const STATUS_ORDER: StatusKey[] = ["active", "stale", "flagged", "superseded", "archived"];

const STATUS_META: Record<StatusKey, { label: string; colorVar: string; swatchClass: string }> = {
  active: { label: "Active", colorVar: "var(--status-good)", swatchClass: "bg-status-good" },
  stale: { label: "Stale", colorVar: "var(--status-warning)", swatchClass: "bg-status-warning" },
  flagged: { label: "Flagged", colorVar: "var(--status-critical)", swatchClass: "bg-status-critical" },
  superseded: { label: "Superseded", colorVar: "var(--viz-axis)", swatchClass: "bg-[var(--viz-axis)]" },
  archived: { label: "Archived", colorVar: "var(--border)", swatchClass: "bg-muted" },
};

export function StatusBreakdownBar({ data }: { data: { status: string; count: number }[] }) {
  const [hovered, setHovered] = useState<StatusKey | null>(null);
  const counts = new Map(data.map((d) => [d.status, d.count]));
  const total = STATUS_ORDER.reduce((sum, key) => sum + (counts.get(key) ?? 0), 0);

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No memories yet.</p>;
  }

  return (
    <div>
      <div className="flex h-6 gap-[2px] overflow-hidden rounded-md" role="img" aria-label="Memory status breakdown">
        {STATUS_ORDER.map((key) => {
          const value = counts.get(key) ?? 0;
          if (value === 0) return null;
          const pct = (value / total) * 100;
          return (
            <button
              key={key}
              type="button"
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(key)}
              onBlur={() => setHovered(null)}
              className={cn(
                "min-w-[3px] transition-opacity",
                STATUS_META[key].swatchClass,
                hovered && hovered !== key && "opacity-40"
              )}
              style={{ width: `${pct}%` }}
              aria-label={`${STATUS_META[key].label}: ${value}`}
            />
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {STATUS_ORDER.map((key) => {
          const value = counts.get(key) ?? 0;
          return (
            <div
              key={key}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-opacity",
                hovered && hovered !== key && "opacity-40"
              )}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className={cn("size-2 rounded-full", STATUS_META[key].swatchClass)} />
              <span className="text-muted-foreground">{STATUS_META[key].label}</span>
              <span className="font-mono tabular-nums text-foreground">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
