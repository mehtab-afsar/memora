import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        {page <= 1 ? (
          <Button variant="outline" size="sm" className="gap-1" disabled>
            <ChevronLeft className="size-3.5" />
            Previous
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            nativeButton={false}
            render={<Link href={hrefFor(page - 1)} />}
          >
            <ChevronLeft className="size-3.5" />
            Previous
          </Button>
        )}
        {page >= totalPages ? (
          <Button variant="outline" size="sm" className="gap-1" disabled>
            Next
            <ChevronRight className="size-3.5" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            nativeButton={false}
            render={<Link href={hrefFor(page + 1)} />}
          >
            Next
            <ChevronRight className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
