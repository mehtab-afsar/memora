import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles, RefreshCw, ShieldCheck, CircleCheck, ArrowRight } from "lucide-react";
import { getProjectInOrg } from "@/lib/org";
import { explain, getMemoryInProject } from "@/lib/memory-engine";
import { TypeBadge } from "@/components/dashboard/type-badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ReconcilingChip } from "@/components/dashboard/reconciling-chip";
import { ConfidenceMeter } from "@/components/dashboard/confidence-meter";
import { MemoryActions } from "@/components/dashboard/memory-actions";
import { VersionTimeline } from "@/components/dashboard/version-timeline";
import { formatRelativeTime } from "@/lib/format";

const EVENT_ICON = {
  extracted: Sparkles,
  updated: RefreshCw,
  verified: ShieldCheck,
  reconfirmed: CircleCheck,
} as const;

const EVENT_LABEL: Record<string, string> = {
  extracted: "Extracted",
  updated: "Updated",
  verified: "Verified",
  reconfirmed: "Reconfirmed",
};

export default async function MemoryDetailPage({
  params,
}: {
  params: Promise<{ org: string; project: string; id: string }>;
}) {
  const { org: orgId, project: projectId, id } = await params;

  const project = await getProjectInOrg(orgId, projectId);
  if (!project) notFound();

  const memory = await getMemoryInProject(id, project.id);
  if (!memory) notFound();

  const detail = await explain(id, { projectId: memory.projectId, environmentId: memory.environmentId });
  if (!detail) notFound();

  const basePath = `/${orgId}/${projectId}`;
  const relatedContradiction = detail.contradictions[0];

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`${basePath}/memories`}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to Memories
      </Link>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <p className="text-base leading-relaxed text-foreground">{memory.content}</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <TypeBadge type={memory.type} />
          <StatusBadge status={memory.status} />
          {detail?.reconciliation.status !== "done" && (
            <ReconcilingChip
              status={detail?.reconciliation.status === "failed" ? "failed" : "pending"}
            />
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Confidence
            <ConfidenceMeter value={memory.confidence} />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Importance
            <ConfidenceMeter value={memory.importance} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>End user: <span className="font-mono text-foreground">{memory.endUserId}</span></span>
          <span>First observed {formatRelativeTime(memory.createdAt)}</span>
          <span>Last confirmed {formatRelativeTime(memory.lastConfirmedAt)}</span>
          {detail?.reconciliation.reconciledAt ? (
            <span>Reconciled {formatRelativeTime(detail.reconciliation.reconciledAt)}</span>
          ) : (
            <span>Not yet reconciled</span>
          )}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <MemoryActions
            orgId={orgId}
            projectId={projectId}
            memoryId={memory.id}
            content={memory.content}
            confidence={memory.confidence}
            importance={memory.importance}
          />
        </div>
      </div>

      {relatedContradiction && (
        <div className="rounded-lg border border-status-critical/30 bg-status-critical/5 p-5">
          <h2 className="text-sm font-semibold text-status-critical">Contradiction detected</h2>
          <p className="mt-1.5 text-sm text-foreground">{relatedContradiction.reasoning}</p>
          <ConflictingMemoryLink
            basePath={basePath}
            currentId={memory.id}
            memoryIdA={relatedContradiction.memoryIdA}
            memoryIdB={relatedContradiction.memoryIdB}
          />
        </div>
      )}

      <VersionTimeline versions={detail.versions} currentIndex={detail.versionIndex} basePath={basePath} />

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-medium text-foreground">Evidence timeline</h2>
        <ul className="flex flex-col gap-4">
          {detail.evidence.map((event) => {
            const Icon = EVENT_ICON[event.eventType as keyof typeof EVENT_ICON] ?? Sparkles;
            return (
              <li key={event.id} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="size-3.5 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{EVENT_LABEL[event.eventType] ?? event.eventType}</span>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(event.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{event.excerpt}</p>
                  {event.reasoning && (
                    <p className="mt-1 text-xs text-muted-foreground italic">&ldquo;{event.reasoning}&rdquo;</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ConflictingMemoryLink({
  basePath,
  currentId,
  memoryIdA,
  memoryIdB,
}: {
  basePath: string;
  currentId: string;
  memoryIdA: string;
  memoryIdB: string;
}) {
  const conflictingId = memoryIdA === currentId ? memoryIdB : memoryIdA;
  return (
    <Link
      href={`${basePath}/memories/${conflictingId}`}
      className="mt-3 inline-flex items-center gap-1 text-sm text-status-critical underline underline-offset-2"
    >
      View conflicting memory
      <ArrowRight className="size-3.5" />
    </Link>
  );
}
