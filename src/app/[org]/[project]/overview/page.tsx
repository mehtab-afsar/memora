import { notFound } from "next/navigation";
import { getProjectInOrg, resolveCurrentEnvironment } from "@/lib/org";
import { getOverviewStats } from "@/lib/memory-engine";
import { OverviewPage, EmptyEnvironmentState } from "@/features/overview/components/overview-page";

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
  if (!environment) {
    return <EmptyEnvironmentState orgId={orgId} projectId={project.id} />;
  }

  const stats = await getOverviewStats(project.id, environment.id);

  return <OverviewPage environmentName={environment.name} stats={stats} />;
}
