"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TypeBadge } from "@/components/dashboard/type-badge";
import { runRecallAction } from "@/app/[org]/[project]/playground/actions";
import type { RecallResult } from "@/lib/memory-engine";

function ScoreBar({ label, value, colorVar }: { label: string; value: number; colorVar: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, backgroundColor: colorVar }} />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-foreground">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export function PlaygroundForm({
  orgId,
  projectId,
  environmentId,
}: {
  orgId: string;
  projectId: string;
  environmentId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<RecallResult[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSubmit = (formData: FormData) => {
    const endUserId = String(formData.get("endUserId") ?? "").trim();
    const query = String(formData.get("query") ?? "").trim();
    const topK = Number(formData.get("topK") ?? 10);

    if (!endUserId || !query) {
      toast.error("End user ID and query are both required");
      return;
    }

    startTransition(async () => {
      try {
        const res = await runRecallAction(orgId, projectId, environmentId, { endUserId, query, topK });
        setResults(res);
        setHasSearched(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Recall failed");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <form action={handleSubmit} className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endUserId">End user ID</Label>
            <Input id="endUserId" name="endUserId" placeholder="user_demo_1" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="topK">Top K</Label>
            <Input id="topK" name="topK" type="number" min={1} max={50} defaultValue={10} />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full gap-1.5 sm:w-auto" disabled={isPending}>
              <Search className="size-3.5" />
              {isPending ? "Recalling..." : "Recall"}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="query">Query</Label>
          <textarea
            id="query"
            name="query"
            placeholder="How should I communicate with this user?"
            required
            rows={2}
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </form>

      {hasSearched && results && (
        <div className="flex flex-col gap-3">
          {results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
              <FlaskConical className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No memories matched this query for this user.</p>
            </div>
          ) : (
            results.map((r, i) => (
              <div key={r.memoryId} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <p className="text-sm text-foreground">{r.content}</p>
                  </div>
                  <TypeBadge type={r.type} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{r.reason}</p>
                <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <ScoreBar label="Relevance" value={r.relevanceScore} colorVar="var(--primary)" />
                  <ScoreBar label="Similarity" value={r.similarity} colorVar="var(--type-3)" />
                  <ScoreBar label="Confidence" value={r.confidence} colorVar="var(--status-good)" />
                  <ScoreBar label="Freshness" value={r.freshness} colorVar="var(--type-4)" />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
