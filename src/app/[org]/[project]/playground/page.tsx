import { FlaskConical } from "lucide-react";
import { notFound } from "next/navigation";
import { getProjectInOrg, resolveCurrentEnvironment } from "@/lib/org";
import { PlaygroundForm } from "@/features/playground/components/playground-form";
import { PageHeader } from "@/components/shared/page-header";

export default async function PlaygroundPage({
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={FlaskConical}
        title="Playground"
        description={
          <>
            Test <code className="font-mono text-xs">recall()</code> against {environment.name} and see exactly why
            each memory ranked where it did.
          </>
        }
      />
      <PlaygroundForm orgId={orgId} projectId={projectId} environmentId={environment.id} />
    </div>
  );
}
