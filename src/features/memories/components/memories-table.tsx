"use client";

import { useRouter } from "next/navigation";
import { SearchX } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TypeBadge } from "@/components/shared/type-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { ReconcilingChip } from "@/components/shared/reconciling-chip";
import { ConfidenceMeter } from "@/components/shared/confidence-meter";
import { EmptyState } from "@/components/shared/empty-state";
import { formatRelativeTime } from "@/lib/format";

type MemoryRow = {
  id: string;
  endUserId: string;
  content: string;
  type: string;
  status: string;
  confidence: number;
  lastConfirmedAt: Date;
  reconciledAt: Date | null;
};

export function MemoriesTable({ memories, basePath }: { memories: MemoryRow[]; basePath: string }) {
  const router = useRouter();

  if (memories.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No memories match these filters"
        description="Try clearing filters, or send some via the remember() API."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Content</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>End user</TableHead>
            <TableHead className="text-right">Last confirmed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {memories.map((m) => (
            <TableRow
              key={m.id}
              className="cursor-pointer"
              onClick={() => router.push(`${basePath}/memories/${m.id}`)}
            >
              <TableCell className="max-w-72 truncate font-medium text-foreground">{m.content}</TableCell>
              <TableCell>
                <TypeBadge type={m.type} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={m.status} />
                  {m.reconciledAt === null && <ReconcilingChip status="pending" />}
                </div>
              </TableCell>
              <TableCell>
                <ConfidenceMeter value={m.confidence} />
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{m.endUserId}</TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {formatRelativeTime(m.lastConfirmedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
