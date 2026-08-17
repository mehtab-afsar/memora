import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectInOrg, resolveCurrentEnvironment } from "@/lib/org";
import { listMemories } from "@/lib/memory-engine";
import { MEMORY_STATUSES, MEMORY_TYPES } from "@/lib/memory-types";
import { MemoryFilters } from "@/components/dashboard/memory-filters";
import { MemoriesTable } from "@/components/dashboard/memories-table";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 25;

export default async function MemoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; project: string }>;
  searchParams: Promise<{ env?: string; user_id?: string; status?: string; type?: string; search?: string; page?: string }>;
}) {
  const { org: orgId, project: projectId } = await params;
  const sp = await searchParams;

  const project = await getProjectInOrg(orgId, projectId);
  if (!project) notFound();

  const { current: environment } = await resolveCurrentEnvironment(project.id, sp.env);
  if (!environment) notFound();

  const page = Math.max(Number(sp.page) || 1, 1);
  const status = MEMORY_STATUSES.includes(sp.status as (typeof MEMORY_STATUSES)[number]) ? sp.status : undefined;
  const type = MEMORY_TYPES.includes(sp.type as (typeof MEMORY_TYPES)[number]) ? sp.type : undefined;

  const result = await listMemories(
    { projectId: project.id, environmentId: environment.id },
    {
      endUserId: sp.user_id || undefined,
      status: status as (typeof MEMORY_STATUSES)[number] | undefined,
      type: type as (typeof MEMORY_TYPES)[number] | undefined,
      search: sp.search || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }
  );

  const basePath = `/${orgId}/${projectId}`;
  const totalPages = Math.max(Math.ceil(result.total / PAGE_SIZE), 1);
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (sp.user_id) params.set("user_id", sp.user_id);
    if (sp.status) params.set("status", sp.status);
    if (sp.type) params.set("type", sp.type);
    if (sp.search) params.set("search", sp.search);
    if (sp.env) params.set("env", sp.env);
    params.set("page", String(p));
    return `${basePath}/memories?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Memories</h1>
          <p className="text-sm text-muted-foreground">
            {result.total.toLocaleString()} memor{result.total === 1 ? "y" : "ies"} in {environment.name}
          </p>
        </div>
      </div>

      <MemoryFilters />

      <MemoriesTable memories={result.memories} basePath={basePath} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page <= 1 ? (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            ) : (
              <Button variant="outline" size="sm" render={<Link href={pageHref(page - 1)} />}>
                Previous
              </Button>
            )}
            {page >= totalPages ? (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            ) : (
              <Button variant="outline" size="sm" render={<Link href={pageHref(page + 1)} />}>
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
