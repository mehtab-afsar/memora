import { notFound } from "next/navigation";
import { getProjectInOrg, resolveCurrentEnvironment } from "@/lib/org";
import { listExperiences } from "@/lib/experience-engine";
import { RecordExperienceDialog } from "@/components/dashboard/record-experience-dialog";
import { ExperienceRecallForm } from "@/components/dashboard/experience-recall-form";
import { OutcomeBadge } from "@/components/dashboard/outcome-badge";
import { formatRelativeTime } from "@/lib/format";

type Experience = Awaited<ReturnType<typeof listExperiences>>["experiences"][number];

/**
 * Groups by exact task text (case-insensitive, trimmed) — not fuzzy/semantic
 * clustering, which would need its own classification step. Preserves the
 * append-only log underneath; this is purely how it's displayed.
 */
function groupByTask(items: Experience[]) {
  const groups = new Map<string, Experience[]>();
  for (const exp of items) {
    const key = exp.task.trim().toLowerCase();
    const existing = groups.get(key);
    if (existing) existing.push(exp);
    else groups.set(key, [exp]);
  }
  // `items` arrives newest-first; keep that as group order, but list each
  // group's own attempts oldest-first so they read as a progression.
  return Array.from(groups.values()).map((attempts) => ({
    taskLabel: attempts[0].task,
    attempts: [...attempts].reverse(),
    failureCount: attempts.filter((a) => a.outcome === "failure").length,
    successCount: attempts.filter((a) => a.outcome === "success").length,
  }));
}

export default async function ExperiencesPage({
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

  const { experiences, total } = await listExperiences({ projectId: project.id, environmentId: environment.id });
  const groups = groupByTask(experiences);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Experiences</h1>
          <p className="text-sm text-muted-foreground">
            What the agent has learned from past attempts in {environment.name} — {total} recorded.
          </p>
        </div>
        <RecordExperienceDialog orgId={orgId} projectId={projectId} environmentId={environment.id} />
      </div>

      <ExperienceRecallForm orgId={orgId} projectId={projectId} environmentId={environment.id} />

      <div>
        <h2 className="mb-3 text-sm font-medium text-foreground">All experiences</h2>
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-sm font-medium text-foreground">No experiences recorded yet</p>
            <p className="text-sm text-muted-foreground">Record one above, or send some via the record() API.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.taskLabel} className="rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{group.taskLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {group.attempts.length} attempt{group.attempts.length === 1 ? "" : "s"}
                    {group.attempts.length > 1 &&
                      ` — ${group.failureCount} failed, ${group.successCount} succeeded`}
                  </p>
                </div>
                <ul className="divide-y divide-border">
                  {group.attempts.map((exp, i) => (
                    <li key={exp.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm text-foreground">
                          {group.attempts.length > 1 && (
                            <span className="mr-1.5 text-xs text-muted-foreground">#{i + 1}</span>
                          )}
                          {exp.action}
                        </p>
                        <OutcomeBadge outcome={exp.outcome} />
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">{exp.lesson}</p>
                      <p className="mt-1.5 text-xs text-muted-foreground">{formatRelativeTime(exp.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
