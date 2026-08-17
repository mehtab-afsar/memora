import Link from "next/link";
import { formatRelativeTime } from "@/lib/format";

type Version = {
  id: string;
  content: string;
  createdAt: Date;
  changeReasoning: string | null;
};

export function VersionTimeline({
  versions,
  currentIndex,
  basePath,
}: {
  versions: Version[];
  currentIndex: number;
  basePath: string;
}) {
  if (versions.length <= 1) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-medium text-foreground">
        Version history <span className="text-muted-foreground">({versions.length} versions)</span>
      </h2>
      <ol className="flex flex-col gap-4">
        {versions.map((version, i) => {
          const isCurrent = i === currentIndex;
          return (
            <li key={version.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={
                    isCurrent
                      ? "flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
                      : "flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground"
                  }
                >
                  v{i + 1}
                </span>
                {i < versions.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                {isCurrent ? (
                  <p className="text-sm font-medium text-foreground">{version.content}</p>
                ) : (
                  <Link
                    href={`${basePath}/memories/${version.id}`}
                    className="text-sm text-foreground underline-offset-2 hover:underline"
                  >
                    {version.content}
                  </Link>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isCurrent ? "Currently viewing" : formatRelativeTime(version.createdAt)}
                </p>
                {version.changeReasoning && i > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground italic">&ldquo;{version.changeReasoning}&rdquo;</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
