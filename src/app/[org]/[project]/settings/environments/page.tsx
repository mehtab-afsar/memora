import { Layers } from "lucide-react";
import { notFound } from "next/navigation";
import { getProjectInOrg, getEnvironmentsForProject, getApiKeyCountsByEnvironment } from "@/lib/org";
import { EnvironmentsManager } from "@/features/environments/components/environments-manager";
import { PageHeader } from "@/components/shared/page-header";

export default async function EnvironmentsSettingsPage({
  params,
}: {
  params: Promise<{ org: string; project: string }>;
}) {
  const { org: orgId, project: projectId } = await params;

  const project = await getProjectInOrg(orgId, projectId);
  if (!project) notFound();

  const [environments, apiKeyCounts] = await Promise.all([
    getEnvironmentsForProject(project.id),
    getApiKeyCountsByEnvironment(project.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Layers}
        title="Environments"
        description="Memories are isolated per environment within this project."
      />
      <EnvironmentsManager orgId={orgId} projectId={projectId} environments={environments} apiKeyCounts={apiKeyCounts} />
    </div>
  );
}
