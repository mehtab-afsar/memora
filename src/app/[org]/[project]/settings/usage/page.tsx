import { notFound } from "next/navigation";
import { Activity, Coins, Sparkles, Search } from "lucide-react";
import { getProjectInOrg, resolveCurrentEnvironment } from "@/lib/org";
import { getUsageSummary } from "@/lib/usage";
import { StatTile } from "@/components/charts/stat-tile";
import { GrowthChart } from "@/components/charts/growth-chart";
import { formatRelativeTime } from "@/lib/format";

const OPERATION_LABELS: Record<string, string> = {
  extract_memories: "Memory extraction",
  decide_memory_action: "Memory decision",
  verify_memory: "Memory verification",
  generate_lesson: "Lesson generation",
  synthesize_recommendation: "Recommendation synthesis",
  document: "Embedding (document)",
  query: "Embedding (query)",
};

export default async function UsagePage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; project: string }>;
  searchParams: Promise<{ env?: string }>;
}) {
  const { org: orgId, project: projectId } = await params;
  const { env } = await searchParams;

  const project = await getProjectInOrg(orgId, projectId);
  if (!project) notFound();

  const { current: environment } = await resolveCurrentEnvironment(project.id, env);
  if (!environment) notFound();

  const summary = await getUsageSummary(project.id, environment.id, 30);
  const anthropicCalls = summary.byOperation
    .filter((r) => r.provider === "anthropic")
    .reduce((sum, r) => sum + r.calls, 0);
  const voyageCalls = summary.byOperation
    .filter((r) => r.provider === "voyage")
    .reduce((sum, r) => sum + r.calls, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Usage</h1>
        <p className="text-sm text-muted-foreground">
          Every Claude and Voyage call in {environment.name}, last 30 days — no plan, no limits, just what&apos;s
          actually being consumed.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total calls" value={summary.totalCalls.toLocaleString()} icon={Activity} />
        <StatTile label="Total tokens" value={summary.totalTokens.toLocaleString()} icon={Coins} />
        <StatTile label="Claude calls" value={anthropicCalls.toLocaleString()} icon={Sparkles} />
        <StatTile label="Voyage calls" value={voyageCalls.toLocaleString()} icon={Search} />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-foreground">Call volume</h2>
          <span className="text-xs text-muted-foreground">Last 30 days</span>
        </div>
        <GrowthChart data={summary.dailyVolume.map((d) => ({ day: d.day, count: d.calls }))} />
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
