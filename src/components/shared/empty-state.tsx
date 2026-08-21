import { cn } from "@/lib/utils";

/**
 * The dashed-border "nothing here" block — was hand-rolled with slightly
 * different padding in Overview, Experiences, and the memories table.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-20 text-center",
        className
      )}
    >
      {Icon && <Icon className="size-5 text-muted-foreground" />}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
