import { notFound } from "next/navigation";
import { getProjectInOrg, getOrgById, resolveCurrentEnvironment } from "@/lib/org";
import { getUsageSummary, USAGE_RANGE_OPTIONS, type UsageRangeDays } from "@/lib/usage";
import { billingPeriodStart, limitsFor } from "@/lib/plans";
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { apiRequests } from "@/db/schema";
import { UsagePage } from "@/features/usage/components/usage-page";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; project: string }>;
  searchParams: Promise<{ env?: string; range?: string }>;
}) {
  const { org: orgId, project: projectId } = await params;
  const { env, range } = await searchParams;

  const project = await getProjectInOrg(orgId, projectId);
  if (!project) notFound();

  const days = (USAGE_RANGE_OPTIONS.find((d) => String(d) === range) ?? 30) as UsageRangeDays;

  const { current: environment } = await resolveCurrentEnvironment(project.id, env);
  if (!environment) notFound();

  const org = await getOrgById(orgId);
  if (!org) notFound();

  const periodStart = billingPeriodStart();
  const limits = limitsFor(org.plan);

  const [summary, writes, reads] = await Promise.all([
    getUsageSummary(project.id, environment.id, days),
    db
      .select({ total: count() })
      .from(apiRequests)
      .where(
        and(eq(apiRequests.orgId, orgId), eq(apiRequests.kind, "writes"), gte(apiRequests.createdAt, periodStart))
      )
      .then(([row]) => row?.total ?? 0),
    db
      .select({ total: count() })
      .from(apiRequests)
      .where(
        and(eq(apiRequests.orgId, orgId), eq(apiRequests.kind, "reads"), gte(apiRequests.createdAt, periodStart))
      )
      .then(([row]) => row?.total ?? 0),
  ]);

  return (
    <UsagePage
      environmentName={environment.name}
      summary={summary}
      days={days}
      quota={{ limits, writes, reads }}
    />
  );
}
