"use client";

import { useState, useTransition } from "react";
import { Search, Lightbulb, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { OutcomeBadge } from "@/components/dashboard/outcome-badge";
import { runExperienceRecallAction, getRecommendationAction } from "@/app/[org]/[project]/experiences/actions";
import type { ExperienceRecallResult, RecommendationResult } from "@/lib/experience-engine";

export function ExperienceRecallForm({
  orgId,
  projectId,
  environmentId,
}: {
  orgId: string;
  projectId: string;
  environmentId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<ExperienceRecallResult[] | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResult>(null);

  const handleSubmit = (formData: FormData) => {
    const query = String(formData.get("query") ?? "").trim();
    if (!query) {
      toast.error("Enter a task to search for");
      return;
    }
    startTransition(async () => {
      try {
        const [recallRes, recommendRes] = await Promise.all([
          runExperienceRecallAction(orgId, projectId, environmentId, query, 10),
          getRecommendationAction(orgId, projectId, environmentId, query).catch(() => null),
        ]);
        setResults(recallRes);
        setRecommendation(recommendRes);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Recall failed");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <form action={handleSubmit} className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="exp-query">Facing a task — search for prior attempts</Label>
          <div className="flex gap-2">
            <Input id="exp-query" name="query" placeholder="Deploy the application to production" className="flex-1" />
            <Button type="submit" size="sm" className="gap-1.5" disabled={isPending}>
              <Search className="size-3.5" />
              {isPending ? "Searching..." : "Search"}
            </Button>
          </div>
        </div>
      </form>

      {recommendation && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
              <Sparkles className="size-3.5" />
              Recommendation
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {Math.round(recommendation.confidence * 100)}% confidence
            </span>
          </div>
          <p className="mt-2 text-sm text-foreground">{recommendation.recommendation}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{recommendation.reasoning}</p>
          {recommendation.supportingExperiences.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Based on {recommendation.supportingExperiences.length} past attempt
              {recommendation.supportingExperiences.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}

      {results && (
        <div className="flex flex-col gap-3">
          {results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
              <Lightbulb className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No prior experiences matched this task.</p>
            </div>
          ) : (
            results.map((r) => (
              <div key={r.experienceId} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-medium text-foreground">{r.task}</p>
                  <OutcomeBadge outcome={r.outcome} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{r.action}</p>
                <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm text-foreground">
                  <Lightbulb className="mr-1.5 inline size-3.5 text-muted-foreground" />
                  {r.lesson}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Relevance {Math.round(r.relevanceScore * 100)}% · Similarity {Math.round(r.similarity * 100)}%
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
