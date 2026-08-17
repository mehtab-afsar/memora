const TYPE_LABELS: Record<string, string> = {
  preference: "Preference",
  fact: "Fact",
  goal: "Goal",
  relationship: "Relationship",
  event: "Event",
  instruction: "Instruction",
  decision: "Decision",
  context: "Context",
};

export function TypeBarList({ data }: { data: { type: string; count: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No active memories yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.count));

  return (
    <div className="flex flex-col gap-2.5">
      {data.map((row) => (
        <div key={row.type} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">
            {TYPE_LABELS[row.type] ?? row.type}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max((row.count / max) * 100, 3)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-foreground">
            {row.count}
          </span>
        </div>
      ))}
    </div>
  );
}
