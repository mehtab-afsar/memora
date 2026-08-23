import Link from "next/link";
import { Activity, Coins, Sparkles, Search, Zap } from "lucide-react";
import { getUsageSummary, type UsageRangeDays, USAGE_RANGE_OPTIONS } from "@/lib/usage";
import type { PlanLimits } from "@/lib/plans";
import { StatTile } from "@/components/charts/stat-tile";
import { GrowthChart } from "@/components/charts/growth-chart";
import { PageHeader } from "@/components/shared/page-header";
import { UsageBar } from "@/components/shared/usage-bar";
import { formatRelativeTime } from "@/lib/format";

type UsageSummary = Awaited<ReturnType<typeof getUsageSummary>>;

const OPERATION_LABELS: Record<string, string> = {
  extract_memories: "Memory extraction",
  decide_memory_action: "Memory decision",
  verify_memory: "Memory verification",
  generate_lesson: "Lesson generation",
  synthesize_recommendation: "Recommendation synthesis",
  document: "Embedding (document)",
  query: "Embedding (query)",
};

function RangeSelector({ days }: { days: UsageRangeDays }) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
      {USAGE_RANGE_OPTIONS.map((option) => (
        <Link
          key={option}
          href={`?range=${option}`}
          scroll={false}
          className={`rounded px-2 py-1 text-xs transition-colors ${
            option === days
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option}d
        </Link>
      ))}
    </div>
  );
}

export function UsagePage({
  environmentName,
  summary,
  days,
  quota,
}: {
  environmentName: string;
  summary: UsageSummary;
  days: UsageRangeDays;
  quota: { limits: PlanLimits; writes: number; reads: number };
}) {
  const anthropicCalls = summary.byOperation
    .filter((r) => r.provider === "anthropic")
    .reduce((sum, r) => sum + r.calls, 0);
  const voyageCalls = summary.byOperation
    .filter((r) => r.provider === "voyage")
    .reduce((sum, r) => sum + r.calls, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Activity}
        title="Usage"
        description={`Every Claude and Voyage call in ${environmentName}, last ${days} days — no plan, no limits, just what's actually being consumed.`}
        actions={<RangeSelector days={days} />}
      />

      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Against your plan this month</p>
        <div className="mt-3 flex flex-col gap-4">
          <UsageBar label="Writes" used={quota.writes} quota={quota.limits.monthlyWrites} />
          <UsageBar label="Reads" used={quota.reads} quota={quota.limits.monthlyReads} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total calls" value={summary.totalCalls.toLocaleString()} icon={Activity} />
        <StatTile label="Total tokens" value={summary.totalTokens.toLocaleString()} icon={Coins} />
        <StatTile label="Claude calls" value={anthropicCalls.toLocaleString()} icon={Sparkles} />
        <StatTile label="Voyage calls" value={voyageCalls.toLocaleString()} icon={Search} />
      </div>

      {summary.cache.readTokens + summary.cache.writeTokens > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Zap className="size-3.5 text-muted-foreground" />
              Prompt cache
            </h2>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {summary.cache.readTokens.toLocaleString()} of{" "}
              {(
                summary.cache.readTokens + summary.cache.writeTokens
              ).toLocaleString()}{" "}
              prefix tokens read from cache
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round(summary.cache.hitRate * 100)}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {Math.round(summary.cache.hitRate * 100)}% of prompt tokens were served from cache at a
            tenth of the usual price. The instructions and tool schema behind every call are
            identical each time, so only your own text is charged in full.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-foreground">Call volume</h2>
          <span className="text-xs text-muted-foreground">Last {days} days</span>
        </div>
        <GrowthChart data={summary.dailyVolume.map((d) => ({ day: d.day, count: d.calls }))} />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-foreground">By API key</h2>
        </div>
        {summary.byApiKey.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No usage yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Key</th>
                <th className="px-4 py-2 text-right font-medium">Calls</th>
                <th className="px-4 py-2 text-right font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.byApiKey.map((row) => (
                <tr key={row.apiKeyId ?? "unknown"}>
                  <td className="px-4 py-2 text-foreground">{row.apiKeyName ?? "Deleted key"}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-foreground">{row.calls}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-muted-foreground">
                    {Number(row.tokens ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-foreground">By operation</h2>
        </div>
        {summary.byOperation.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No usage yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Operation</th>
                <th className="px-4 py-2 font-medium">Provider</th>
                <th className="px-4 py-2 text-right font-medium">Calls</th>
                <th className="px-4 py-2 text-right font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.byOperation.map((row) => (
                <tr key={`${row.provider}-${row.operation}`}>
                  <td className="px-4 py-2 text-foreground">{OPERATION_LABELS[row.operation] ?? row.operation}</td>
                  <td className="px-4 py-2 text-muted-foreground capitalize">{row.provider}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-foreground">{row.calls}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-muted-foreground">
                    {Number(row.tokens ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-foreground">Recent activity</h2>
        </div>
        {summary.recentEvents.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No calls recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {summary.recentEvents.map((event) => (
              <li key={event.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-foreground">{OPERATION_LABELS[event.operation] ?? event.operation}</span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {event.source}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{formatRelativeTime(event.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
