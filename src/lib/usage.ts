import { and, count, desc, eq, gte, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { usageEvents } from "@/db/schema";

/**
 * Total tokens for one event.
 *
 * `input_tokens` counts only what was processed at full price — once prompt
 * caching is on, the cached prefix is reported separately, so summing input +
 * output silently under-counts by however much was served from cache. That is
 * most of a prompt here, so the omission would be large rather than academic.
 */
const eventTokens = sql`coalesce(
  ${usageEvents.totalTokens},
  coalesce(${usageEvents.inputTokens}, 0)
    + coalesce(${usageEvents.cacheReadTokens}, 0)
    + coalesce(${usageEvents.cacheWriteTokens}, 0)
    + coalesce(${usageEvents.outputTokens}, 0),
  0
)`;

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
        totalTokens: sum(eventTokens),
        cacheReadTokens: sum(sql`coalesce(${usageEvents.cacheReadTokens}, 0)`),
        cacheWriteTokens: sum(sql`coalesce(${usageEvents.cacheWriteTokens}, 0)`),
        uncachedInputTokens: sum(sql`coalesce(${usageEvents.inputTokens}, 0)`),
      })
      .from(usageEvents)
      .where(scopeCondition),
    db
      .select({
        provider: usageEvents.provider,
        operation: usageEvents.operation,
        calls: count(),
        tokens: sum(eventTokens),
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

  const cacheRead = Number(totals[0]?.cacheReadTokens ?? 0);
  const cacheWrite = Number(totals[0]?.cacheWriteTokens ?? 0);
  const uncachedInput = Number(totals[0]?.uncachedInputTokens ?? 0);
  const promptTokens = cacheRead + cacheWrite + uncachedInput;

  return {
    totalCalls: totals[0]?.totalCalls ?? 0,
    totalTokens: Number(totals[0]?.totalTokens ?? 0),
    cache: {
      readTokens: cacheRead,
      writeTokens: cacheWrite,
      /**
       * The share of prompt tokens served from cache at a tenth of the price.
       * Low here means either genuinely low volume or a prefix that is drifting
       * between requests — scripts/cache-probe.ts tells the two apart.
       */
      hitRate: promptTokens === 0 ? 0 : cacheRead / promptTokens,
    },
    byOperation,
    dailyVolume,
    recentEvents,
  };
}
