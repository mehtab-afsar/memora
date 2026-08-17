import { notFound } from "next/navigation";
import { getProjectInOrg, getEnvironmentsForProject, getApiKeysForEnvironment } from "@/lib/org";
import { ApiKeysManager } from "@/components/dashboard/api-keys-manager";

export default async function ApiKeysSettingsPage({
  params,
}: {
  params: Promise<{ org: string; project: string }>;
}) {
  const { org: orgId, project: projectId } = await params;

  const project = await getProjectInOrg(orgId, projectId);
  if (!project) notFound();

  const environments = await getEnvironmentsForProject(project.id);
  const withKeys = await Promise.all(
    environments.map(async (env) => ({ ...env, keys: await getApiKeysForEnvironment(env.id) }))
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">API Keys</h1>
        <p className="text-sm text-muted-foreground">Manage keys per environment. Full keys are only ever shown once.</p>
      </div>
      <ApiKeysManager orgId={orgId} projectId={projectId} environments={withKeys} />
    </div>
  );
}
