import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "@/db";
import { usageEvents } from "@/db/schema";

export type UsageScope = {
  projectId: string;
  environmentId: string;
  apiKeyId?: string;
  source: "api" | "dashboard";
};

export type UsageEvent = {
  provider: "anthropic" | "voyage";
  operation: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

type Store = { scope: UsageScope; events: UsageEvent[] };

const storage = new AsyncLocalStorage<Store>();

/**
 * Records one Claude/Voyage call against the current tracked scope. A no-op
 * outside a withUsageTracking() call — callTool()/embed() can call this
 * unconditionally without knowing whether they're inside a metered request
 * (e.g. a one-off script), so nothing breaks if some call path isn't wrapped.
 */
export function recordUsage(event: UsageEvent) {
  storage.getStore()?.events.push(event);
}

/**
 * Wraps a request (an API route handler or a dashboard Server Action body)
 * in a usage-tracking scope. Every recordUsage() call made anywhere in the
 * call stack during `fn` — however deep, e.g. inside memory-engine.ts's
 * calls into anthropic.ts/voyage.ts — lands in this scope's accumulator,
 * persisted as one row per event once `fn` completes.
 */
export async function withUsageTracking<T>(scope: UsageScope, fn: () => Promise<T>): Promise<T> {
  const store: Store = { scope, events: [] };
  const result = await storage.run(store, fn);

  if (store.events.length > 0) {
    await db.insert(usageEvents).values(
      store.events.map((event) => ({
        projectId: store.scope.projectId,
        environmentId: store.scope.environmentId,
        apiKeyId: store.scope.apiKeyId,
        source: store.scope.source,
        provider: event.provider,
        operation: event.operation,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        totalTokens: event.totalTokens,
      }))
    );
  }

  return result;
}
