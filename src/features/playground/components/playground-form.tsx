"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TypeBadge } from "@/components/shared/type-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { runRecallAction, runRememberAction } from "@/features/playground/actions/playground-actions";
import type { RecallResult, RememberOutcome } from "@/lib/memory-engine";

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

  const [isWriting, startWriting] = useTransition();
  const [written, setWritten] = useState<RememberOutcome[] | null>(null);
  // Kept in state rather than left to the form so both halves share it — the
  // whole point is to write for a user and then immediately recall the same one.
  const [endUserId, setEndUserId] = useState("user_demo_1");

  const handleRemember = (formData: FormData) => {
    const content = String(formData.get("content") ?? "").trim();
    if (!endUserId.trim() || !content) {
      toast.error("End user ID and message are both required");
      return;
    }

    startWriting(async () => {
      try {
        const outcomes = await runRememberAction(orgId, projectId, environmentId, {
          endUserId: endUserId.trim(),
          content,
        });
        setWritten(outcomes);
        toast.success(
          outcomes.length === 0
            ? "Nothing durable to remember in that"
            : `Stored ${outcomes.length} ${outcomes.length === 1 ? "memory" : "memories"}`
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Remember failed");
      }
    });
  };

  const handleSubmit = (formData: FormData) => {
    const query = String(formData.get("query") ?? "").trim();
    const topK = Number(formData.get("topK") ?? 10);

    if (!endUserId.trim() || !query) {
      toast.error("End user ID and query are both required");
      return;
    }

    startTransition(async () => {
      try {
        const res = await runRecallAction(orgId, projectId, environmentId, {
          endUserId: endUserId.trim(),
          query,
          topK,
        });
        setResults(res);
        setHasSearched(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Recall failed");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-1.5">
          <Label htmlFor="endUserId">End user ID</Label>
          <Input
            id="endUserId"
            value={endUserId}
            onChange={(e) => setEndUserId(e.target.value)}
            placeholder="user_demo_1"
            className="sm:max-w-xs"
          />
          <p className="text-xs text-muted-foreground">
            Both halves below act on this user. Write something first, then ask for it back.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <form action={handleRemember}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="content">Say something as this user</Label>
              <textarea
                id="content"
                name="content"
                placeholder="I'm vegan and allergic to peanuts. I only take morning meetings."
                required
                rows={2}
                className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Extracted, stored, then judged against what is already known — all before this returns.
              </p>
              <Button type="submit" variant="outline" className="shrink-0 gap-1.5" disabled={isWriting}>
                <Sparkles className="size-3.5" />
                {isWriting ? "Remembering..." : "Remember"}
              </Button>
            </div>

            {written && (
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                {written.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing durable in that — reactions and small talk are deliberately discarded.
                  </p>
                ) : (
                  written.map((o) => (
                    <div key={o.memoryId ?? o.candidateContent} className="flex items-start gap-2">
                      <span className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                        {o.decision}
                      </span>
                      <p className="text-sm text-foreground">{o.candidateContent}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <form action={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
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
        </CardContent>
      </Card>

      {hasSearched && results && (
        <div className="flex flex-col gap-3">
          {results.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="No memories matched this query for this user"
              className="py-16"
            />
          ) : (
            results.map((r, i) => (
              <Card key={r.memoryId}>
                <CardContent>
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
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
