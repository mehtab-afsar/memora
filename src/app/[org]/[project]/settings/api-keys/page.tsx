import { KeyRound } from "lucide-react";
import { notFound } from "next/navigation";
import { getProjectInOrg, getEnvironmentsForProject, getApiKeysForEnvironment } from "@/lib/org";
import { ApiKeysManager } from "@/features/api-keys/components/api-keys-manager";
import { PageHeader } from "@/components/shared/page-header";

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
      <PageHeader
        icon={KeyRound}
        title="API Keys"
        description="Manage keys per environment. Full keys are only ever shown once."
      />
      <ApiKeysManager orgId={orgId} projectId={projectId} environments={withKeys} />
    </div>
  );
}
