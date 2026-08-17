import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warning" | "critical";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const toneClass = {
    default: "text-foreground",
    good: "text-status-good",
    warning: "text-status-warning",
    critical: "text-status-critical",
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && <Icon className={cn("size-3.5", toneClass)} />}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tracking-tight", toneClass)}>{value}</div>
    </div>
  );
}
