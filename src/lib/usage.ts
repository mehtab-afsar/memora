import { and, count, desc, eq, gte, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { usageEvents } from "@/db/schema";

export async function getUsageSummary(projectId: string, environmentId: string, days = 30) {
  const scopeCondition = and(
    eq(usageEvents.projectId, projectId),
    eq(usageEvents.environmentId, environmentId),
    gte(usageEvents.createdAt, sql`now() - (${days} * interval '1 day')`)
  );

  const [totals, byOperation, dailyVolume, recentEvents] = await Promise.all([
    db
      .select({
        totalCalls: count(),
        totalTokens: sum(
          sql`coalesce(${usageEvents.totalTokens}, ${usageEvents.inputTokens} + ${usageEvents.outputTokens}, 0)`
        ),
      })
      .from(usageEvents)
      .where(scopeCondition),
    db
      .select({
        provider: usageEvents.provider,
        operation: usageEvents.operation,
        calls: count(),
        tokens: sum(
          sql`coalesce(${usageEvents.totalTokens}, ${usageEvents.inputTokens} + ${usageEvents.outputTokens}, 0)`
        ),
      })
      .from(usageEvents)
      .where(scopeCondition)
      .groupBy(usageEvents.provider, usageEvents.operation)
      .orderBy(desc(count())),
    db
      .select({
        day: sql<string>`date_trunc('day', ${usageEvents.createdAt})::date`,
        calls: count(),
      })
      .from(usageEvents)
      .where(scopeCondition)
      .groupBy(sql`date_trunc('day', ${usageEvents.createdAt})::date`)
      .orderBy(sql`date_trunc('day', ${usageEvents.createdAt})::date`),
    db
      .select()
      .from(usageEvents)
      .where(and(eq(usageEvents.projectId, projectId), eq(usageEvents.environmentId, environmentId)))
      .orderBy(desc(usageEvents.createdAt))
      .limit(20),
  ]);

  return {
    totalCalls: totals[0]?.totalCalls ?? 0,
    totalTokens: Number(totals[0]?.totalTokens ?? 0),
    byOperation,
    dailyVolume,
    recentEvents,
  };
}
