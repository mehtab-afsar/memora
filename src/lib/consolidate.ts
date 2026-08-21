import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { memories, userProfiles } from "@/db/schema";
import { consolidateProfile } from "@/lib/anthropic";

/**
 * Consolidation — turning a pile of memories into an understanding of a person.
 *
 * `recall` is search, and search is the wrong shape for "what do you know about
 * this person?". One dense conversation in our LoCoMo run produced 210 memories
 * for a single user; ranked against each other they score within a hair, and the
 * fact you needed sits at position eleven. Better ranking helps at the margin.
 * A different representation fixes it.
 *
 * So periodically we read a user's active memories and write one short profile,
 * stored alongside — not instead of — the memories it came from. Recall returns
 * both: the profile for the shape of the person, the ranked memories for detail.
 *
 * This is the one place in the pipeline where the model is asked to *reason
 * across* the corpus rather than judge one row at a time.
 */

/** Cap on how many memories go into one profile, newest and most important first. */
const MAX_MEMORIES_IN_PROFILE = 150;

/** Regenerate once this many memories have been added or removed since last time. */
const DRIFT_THRESHOLD = 10;

/** Regenerate anyway after this long, so a quiet user's profile still ages out. */
const MAX_PROFILE_AGE_DAYS = 30;

/** Below this there is nothing to consolidate — the memories already are the profile. */
const MIN_MEMORIES_TO_CONSOLIDATE = 8;

export type ProfileScope = { projectId: string; environmentId: string; endUserId: string };

export type StoredProfile = {
  content: string;
  sourceMemoryIds: string[];
  memoryCount: number;
  generatedAt: Date;
};

/**
 * Whether a profile needs rebuilding. Pure so the policy can be tested without
 * a database or a model — the thresholds are a cost decision as much as a
 * quality one, and they should be arguable in a test rather than in production.
 */
export function needsConsolidation(params: {
  currentMemoryCount: number;
  existing: { memoryCount: number; generatedAt: Date } | null;
  now?: Date;
}): boolean {
  const { currentMemoryCount, existing } = params;
  const now = params.now ?? new Date();

  if (currentMemoryCount < MIN_MEMORIES_TO_CONSOLIDATE) return false;
  if (!existing) return true;

  const drift = Math.abs(currentMemoryCount - existing.memoryCount);
  if (drift >= DRIFT_THRESHOLD) return true;

  const ageDays = (now.getTime() - existing.generatedAt.getTime()) / 86_400_000;
  // Age alone is not enough: rebuilding an unchanged profile costs a model call
  // and produces the same paragraph.
  return ageDays >= MAX_PROFILE_AGE_DAYS && drift > 0;
}

export async function getProfile(scope: ProfileScope): Promise<StoredProfile | null> {
  const [row] = await db
    .select()
    .from(userProfiles)
    .where(
      and(
        eq(userProfiles.projectId, scope.projectId),
        eq(userProfiles.environmentId, scope.environmentId),
        eq(userProfiles.endUserId, scope.endUserId)
      )
    )
    .limit(1);

  if (!row) return null;
  return {
    content: row.content,
    sourceMemoryIds: row.sourceMemoryIds as string[],
    memoryCount: row.memoryCount,
    generatedAt: row.generatedAt,
  };
}

/**
 * Rebuilds a user's profile from their current memories. Returns null when
 * there is nothing worth consolidating.
 *
 * Runs off the request path — from the reconciliation worker, after a drain —
 * because it costs a model call over a large prompt and nothing about a
 * caller's latency should depend on it.
 */
export async function consolidate(scope: ProfileScope, force = false): Promise<StoredProfile | null> {
  const rows = await db
    .select({
      id: memories.id,
      content: memories.content,
      type: memories.type,
      status: memories.status,
      confidence: memories.confidence,
    })
    .from(memories)
    .where(
      and(
        eq(memories.projectId, scope.projectId),
        eq(memories.environmentId, scope.environmentId),
        eq(memories.endUserId, scope.endUserId),
        // Flagged memories are included on purpose: an unresolved contradiction
        // is part of what is known about someone, and the profile is told to
        // say so rather than pick a side.
        inArray(memories.status, ["active", "flagged"])
      )
    )
    .orderBy(desc(memories.importance), desc(memories.lastConfirmedAt))
    .limit(MAX_MEMORIES_IN_PROFILE);

  const existing = await getProfile(scope);
  if (!force && !needsConsolidation({ currentMemoryCount: rows.length, existing })) return null;
  if (rows.length === 0) return null;

  const { profile, used_memory_ids } = await consolidateProfile(rows);

  // Keep only ids that really exist — a hallucinated source id would make the
  // audit trail lie, which is worse than a shorter one.
  const known = new Set(rows.map((r) => r.id));
  const sourceMemoryIds = used_memory_ids.filter((id) => known.has(id));

  const values = {
    projectId: scope.projectId,
    environmentId: scope.environmentId,
    endUserId: scope.endUserId,
    content: profile,
    sourceMemoryIds,
    memoryCount: rows.length,
    generatedAt: new Date(),
  };

  const [saved] = await db
    .insert(userProfiles)
    .values(values)
    .onConflictDoUpdate({
      target: [userProfiles.projectId, userProfiles.environmentId, userProfiles.endUserId],
      set: {
        content: values.content,
        sourceMemoryIds: values.sourceMemoryIds,
        memoryCount: values.memoryCount,
        generatedAt: values.generatedAt,
      },
    })
    .returning();

  return {
    content: saved.content,
    sourceMemoryIds: saved.sourceMemoryIds as string[],
    memoryCount: saved.memoryCount,
    generatedAt: saved.generatedAt,
  };
}

/**
 * Consolidates every user in a scope whose profile has drifted. Called by the
 * worker after it drains the reconciliation queue, so profiles catch up shortly
 * after the writes that changed them.
 */
export async function consolidateStale(
  scope: { projectId: string; environmentId: string },
  limit = 20
): Promise<number> {
  const users = await db
    .selectDistinct({ endUserId: memories.endUserId })
    .from(memories)
    .where(and(eq(memories.projectId, scope.projectId), eq(memories.environmentId, scope.environmentId)))
    .limit(limit);

  let rebuilt = 0;
  for (const { endUserId } of users) {
    const profile = await consolidate({ ...scope, endUserId });
    if (profile) rebuilt += 1;
  }
  return rebuilt;
}
