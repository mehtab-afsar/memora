import { notFound } from "next/navigation";
import { getProjectInOrg, getEnvironmentsForProject } from "@/lib/org";
import { EnvironmentsManager } from "@/features/environments/components/environments-manager";

export default async function EnvironmentsSettingsPage({
  params,
}: {
  params: Promise<{ org: string; project: string }>;
}) {
  const { org: orgId, project: projectId } = await params;

  const project = await getProjectInOrg(orgId, projectId);
  if (!project) notFound();

  const environments = await getEnvironmentsForProject(project.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Environments</h1>
        <p className="text-sm text-muted-foreground">Memories are isolated per environment within this project.</p>
      </div>
      <EnvironmentsManager orgId={orgId} projectId={projectId} environments={environments} />
    </div>
  );
}
