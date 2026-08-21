import { notFound } from "next/navigation";
import { getProjectInOrg, resolveCurrentEnvironment } from "@/lib/org";
import { getUsageSummary } from "@/lib/usage";
import { UsagePage } from "@/features/usage/components/usage-page";

export default async function Page({
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

  return <UsagePage environmentName={environment.name} summary={summary} />;
}
