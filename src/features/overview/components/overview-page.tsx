import {
  LayoutDashboard,
  Database,
  Gauge,
  AlertTriangle,
  Flag,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  CircleCheck,
  Layers,
} from "lucide-react";
import { getOverviewStats } from "@/lib/memory-engine";
import { StatTile } from "@/components/charts/stat-tile";
import { StatusBreakdownBar } from "@/components/charts/status-breakdown-bar";
import { TypeBarList } from "@/components/charts/type-bar-list";
import { GrowthChart } from "@/components/charts/growth-chart";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { formatPercent, formatRelativeTime } from "@/lib/format";

type OverviewStats = Awaited<ReturnType<typeof getOverviewStats>>;

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

export function OverviewPage({ environmentName, stats }: { environmentName: string; stats: OverviewStats }) {
  const activeCount = stats.byStatus.find((s) => s.status === "active")?.count ?? 0;
  const flaggedCount = stats.byStatus.find((s) => s.status === "flagged")?.count ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={LayoutDashboard} title="Overview" description={`Memory health for ${environmentName}.`} />

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
        <Card>
          <CardHeader>
            <CardTitle>Status breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdownBar data={stats.byStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active memories by type</CardTitle>
          </CardHeader>
          <CardContent>
            <TypeBarList data={stats.byType} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Memory growth</CardTitle>
          <CardAction>
            <span className="text-xs text-muted-foreground">Last 30 days</span>
          </CardAction>
        </CardHeader>
        <CardContent>
          <GrowthChart data={stats.growth} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}

export function EmptyEnvironmentState({ orgId, projectId }: { orgId: string; projectId: string }) {
  return (
    <EmptyState
      icon={Layers}
      title="No environment yet"
      description={
        <>
          Create one in{" "}
          <a href={`/${orgId}/${projectId}/settings/environments`} className="text-primary underline underline-offset-2">
            Settings → Environments
          </a>
          .
        </>
      }
      className="py-24"
    />
  );
}
