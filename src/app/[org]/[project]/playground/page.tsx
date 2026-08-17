import { notFound } from "next/navigation";
import { getProjectInOrg, resolveCurrentEnvironment } from "@/lib/org";
import { PlaygroundForm } from "@/components/dashboard/playground-form";

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
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Playground</h1>
        <p className="text-sm text-muted-foreground">
          Test <code className="font-mono text-xs">recall()</code> against {environment.name} and see exactly why each
          memory ranked where it did.
        </p>
      </div>
      <PlaygroundForm orgId={orgId} projectId={projectId} environmentId={environment.id} />
    </div>
  );
}
