import { Lightbulb } from "lucide-react";
import { notFound } from "next/navigation";
import { getProjectInOrg, resolveCurrentEnvironment } from "@/lib/org";
import { listExperiences } from "@/lib/experience-engine";
import { RecordExperienceDialog } from "@/features/experiences/components/record-experience-dialog";
import { ExperienceRecallForm } from "@/features/experiences/components/experience-recall-form";
import { OutcomeBadge } from "@/features/experiences/components/outcome-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
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
      <PageHeader
        icon={Lightbulb}
        title="Experiences"
        description={`What the agent has learned from past attempts in ${environment.name} — ${total} recorded.`}
        actions={<RecordExperienceDialog orgId={orgId} projectId={projectId} environmentId={environment.id} />}
      />

      <ExperienceRecallForm orgId={orgId} projectId={projectId} environmentId={environment.id} />

      <div>
        <h2 className="mb-3 text-sm font-medium text-foreground">All experiences</h2>
        {groups.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="No experiences recorded yet"
            description="Record one above, or send some via the record() API."
            className="py-16"
          />
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <Card key={group.taskLabel}>
                <CardHeader className="border-b border-border">
                  <CardTitle>{group.taskLabel}</CardTitle>
                  <CardAction>
                    <span className="text-xs text-muted-foreground">
                      {group.attempts.length} attempt{group.attempts.length === 1 ? "" : "s"}
                      {group.attempts.length > 1 &&
                        ` — ${group.failureCount} failed, ${group.successCount} succeeded`}
                    </span>
                  </CardAction>
                </CardHeader>
                <CardContent className="px-0">
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
