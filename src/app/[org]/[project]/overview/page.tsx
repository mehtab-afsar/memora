import { Database, Gauge, AlertTriangle, Flag, Sparkles, RefreshCw, ShieldCheck, CircleCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { getProjectInOrg, resolveCurrentEnvironment } from "@/lib/org";
import { getOverviewStats } from "@/lib/memory-engine";
import { StatTile } from "@/components/charts/stat-tile";
import { StatusBreakdownBar } from "@/components/charts/status-breakdown-bar";
import { TypeBarList } from "@/components/charts/type-bar-list";
import { GrowthChart } from "@/components/charts/growth-chart";
import { formatPercent, formatRelativeTime } from "@/lib/format";

const EVENT_ICON = {
  extracted: Sparkles,
  updated: RefreshCw,
  verified: ShieldCheck,
  reconfirmed: CircleCheck,
} as const;

const EVENT_LABEL: Record<string, string> = {
  extracted: "Extracted",
  updated: "Updated",
  verified: "Verified",
  reconfirmed: "Reconfirmed",
};

export default async function OverviewPage({
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
  if (!environment) {
    return <EmptyEnvironmentState orgId={orgId} projectId={project.id} />;
  }

  const stats = await getOverviewStats(project.id, environment.id);
  const activeCount = stats.byStatus.find((s) => s.status === "active")?.count ?? 0;
  const flaggedCount = stats.byStatus.find((s) => s.status === "flagged")?.count ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground">Memory health for {environment.name}.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Active memories" value={activeCount.toLocaleString()} icon={Database} />
        <StatTile label="Avg. confidence" value={formatPercent(stats.avgConfidence)} icon={Gauge} />
        <StatTile
          label="Open contradictions"
          value={stats.openContradictions.toLocaleString()}
          icon={AlertTriangle}
          tone={stats.openContradictions > 0 ? "warning" : "default"}
        />
        <StatTile
          label="Flagged"
          value={flaggedCount.toLocaleString()}
          icon={Flag}
          tone={flaggedCount > 0 ? "critical" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Status breakdown">
          <StatusBreakdownBar data={stats.byStatus} />
        </Card>
        <Card title="Active memories by type">
          <TypeBarList data={stats.byType} />
        </Card>
      </div>

      <Card title="Memory growth" subtitle="Last 30 days">
        <GrowthChart data={stats.growth} />
      </Card>

      <Card title="Recent activity">
        {stats.recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {stats.recentActivity.map((event) => {
              const Icon = EVENT_ICON[event.eventType as keyof typeof EVENT_ICON] ?? Sparkles;
              return (
                <li key={event.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-3.5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{event.memoryContent}</p>
                    <p className="text-xs text-muted-foreground">
                      {EVENT_LABEL[event.eventType] ?? event.eventType} · {formatRelativeTime(event.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function EmptyEnvironmentState({ orgId, projectId }: { orgId: string; projectId: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-24 text-center">
      <p className="text-sm font-medium text-foreground">No environment yet</p>
      <p className="text-sm text-muted-foreground">
        Create one in{" "}
        <a href={`/${orgId}/${projectId}/settings/environments`} className="text-primary underline underline-offset-2">
          Settings → Environments
        </a>
        .
      </p>
    </div>
  );
}
