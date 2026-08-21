import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { erasureRecords, memories, memoryEvidence, userProfiles } from "@/db/schema";

/** A single end user within one project environment. */
export type UserScope = { projectId: string; environmentId: string; endUserId: string };

/**
 * Erasure and export — the data-subject rights path.
 *
 * Everywhere else in this system, deleting means archiving: `forgetMemory()`
 * sets `status = 'archived'` and keeps the row, because the version chain and
 * the evidence trail are the product. That is the right default and the wrong
 * answer to a GDPR Article 17 request, where the obligation is that the data
 * stops existing. So erasure is a separate, explicit operation rather than a
 * mode of the ordinary delete: nobody should reach it by accident, and nobody
 * answering a legal request should have to hope archiving counts.
 *
 * What a memory row takes with it, by foreign key cascade:
 *
 *   memory_evidence        the source excerpts — the actual quoted user text
 *   reconciliation_jobs    any pending judgement of this memory
 *   contradictions         rows referencing it as either side
 *
 * The embedding lives in the row itself and goes with it. That matters more
 * than it looks: an embedding is derived from the content and, with the right
 * attack, partially invertible — leaving one behind would leave personal data
 * behind.
 *
 * What is deliberately NOT erased: `api_requests`, `usage_events`,
 * `rate_limit_windows` and `idempotency_keys`. None of them store end-user
 * content or an end-user identifier — they hold an org, a project, a key id and
 * a count. They are billing and abuse records, they are what an operator needs
 * to answer a disputed invoice, and erasing them would be erasing our own
 * records rather than the subject's data.
 */

/**
 * A subject reference that survives erasure without retaining the identifier.
 *
 * An erasure log is not optional bookkeeping — an operator has to be able to
 * demonstrate that a request was actioned. But writing the end-user id into
 * that log would retain, forever, exactly the identifier we were asked to
 * forget. Hashing with the project scope means the operator can prove erasure
 * for an id they already know (recompute and compare) while the log alone
 * identifies nobody, and a hash from one project tells you nothing about
 * another.
 */
export function subjectHash(scope: UserScope): string {
  // Length-prefixed rather than joined by a separator. End-user ids are opaque
  // caller-supplied strings, so a plain join is ambiguous — two different
  // subjects can produce the same input and therefore the same hash, which in
  // an erasure log means proving the wrong person's data was destroyed.
  const parts = [scope.projectId, scope.environmentId, scope.endUserId];
  return createHash("sha256")
    .update(parts.map((part) => `${part.length}:${part}`).join(""))
    .digest("hex");
}

export type ErasureResult = {
  memoriesErased: number;
  profilesErased: number;
  subjectHash: string;
};

/**
 * Permanently destroys everything held about one end user within a project
 * environment. Not reversible, which is the point.
 */
export async function eraseUser(scope: UserScope, requestedVia: "api" | "dashboard"): Promise<ErasureResult> {
  const scopeFilter = and(
    eq(memories.projectId, scope.projectId),
    eq(memories.environmentId, scope.environmentId),
    eq(memories.endUserId, scope.endUserId)
  );

  return db.transaction(async (tx) => {
    // The profile first. It is derived from the memories and quotes them, so it
    // is personal data in its own right, and it has no foreign key to them —
    // deleting the memories alone would leave a readable summary of the person
    // we were told to forget.
    const profiles = await tx
      .delete(userProfiles)
      .where(
        and(
          eq(userProfiles.projectId, scope.projectId),
          eq(userProfiles.environmentId, scope.environmentId),
          eq(userProfiles.endUserId, scope.endUserId)
        )
      )
      .returning({ id: userProfiles.id });

    const erased = await tx.delete(memories).where(scopeFilter).returning({ id: memories.id });

    const hash = subjectHash(scope);
    await tx.insert(erasureRecords).values({
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      subjectHash: hash,
      memoriesErased: erased.length,
      profilesErased: profiles.length,
      requestedVia,
    });

    return { memoriesErased: erased.length, profilesErased: profiles.length, subjectHash: hash };
  });
}

/**
 * Permanently destroys one memory. Distinct from `forgetMemory()`, which
 * archives — see the note at the top of this file.
 */
export async function eraseMemory(
  memoryId: string,
  projectScope: { projectId: string; environmentId: string }
): Promise<boolean> {
  const deleted = await db
    .delete(memories)
    .where(
      and(
        eq(memories.id, memoryId),
        eq(memories.projectId, projectScope.projectId),
        eq(memories.environmentId, projectScope.environmentId)
      )
    )
    .returning({ id: memories.id });

  return deleted.length > 0;
}

/**
 * Everything held about one end user, in a form a person can read.
 *
 * The counterpart to erasure: Article 15 asks what you hold about someone and
 * Article 20 asks for it in a portable format, and both are far easier to
 * answer honestly than to answer after the fact. Archived and superseded
 * memories are included on purpose — "we still hold it but stopped using it" is
 * still holding it.
 */
export async function exportUser(scope: UserScope) {
  const rows = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.projectId, scope.projectId),
        eq(memories.environmentId, scope.environmentId),
        eq(memories.endUserId, scope.endUserId)
      )
    );

  const evidence = rows.length
    ? await db
        .select()
        .from(memoryEvidence)
        .where(inArray(memoryEvidence.memoryId, rows.map((row) => row.id)))
    : [];

  const [profile] = await db
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

  const byMemory = new Map<string, typeof evidence>();
  for (const item of evidence) {
    const list = byMemory.get(item.memoryId) ?? [];
    list.push(item);
    byMemory.set(item.memoryId, list);
  }

  return {
    userId: scope.endUserId,
    exportedAt: new Date().toISOString(),
    profile: profile
      ? { content: profile.content, generatedAt: profile.generatedAt, memoryCount: profile.memoryCount }
      : null,
    memories: rows.map((row) => ({
      id: row.id,
      content: row.content,
      type: row.type,
      status: row.status,
      confidence: row.confidence,
      importance: row.importance,
      agentId: row.agentId,
      sessionId: row.sessionId,
      source: { type: row.sourceType, id: row.sourceId },
      metadata: row.metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastConfirmedAt: row.lastConfirmedAt,
      supersedesId: row.supersedesId,
      // The excerpts this was learned from — the subject's own words, and the
      // part of an export that actually answers "what do you have on me?".
      evidence: (byMemory.get(row.id) ?? []).map((e) => ({
        excerpt: e.excerpt,
        eventType: e.eventType,
        reasoning: e.reasoning,
        source: { type: e.sourceType, id: e.sourceId },
        createdAt: e.createdAt,
      })),
    })),
  };
}
