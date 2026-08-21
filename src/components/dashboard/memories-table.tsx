"use client";

import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TypeBadge } from "@/components/dashboard/type-badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ReconcilingChip } from "@/components/dashboard/reconciling-chip";
import { ConfidenceMeter } from "@/components/dashboard/confidence-meter";
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
      <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border py-20 text-center">
        <p className="text-sm font-medium text-foreground">No memories match these filters</p>
        <p className="text-sm text-muted-foreground">Try clearing filters, or send some via the remember() API.</p>
      </div>
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
