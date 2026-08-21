/**
 * Plan limits.
 *
 * These are deliberately code, not database rows: changing what a plan includes
 * should be a reviewed diff, not an UPDATE someone runs at 2am. Only the plan
 * *name* is persisted, on `organizations.plan`.
 *
 * The numbers are placeholders until pricing is decided, but the enforcement
 * around them is real. What is known: the pipeline costs about $8.22 per 1,000
 * memories in model spend (evals/results), so the free tier's ceiling is what
 * stands between a signup and an unbounded bill.
 */

export type PlanName = "free" | "starter" | "pro" | "enterprise";

export type PlanLimits = {
  label: string;
  /** Writes per calendar month. `remember` and `experiences.record`. */
  monthlyWrites: number | null;
  /** Reads per calendar month. `recall`, `recommend`, list endpoints. */
  monthlyReads: number | null;
  /** Requests per minute, per API key. */
  requestsPerMinute: number;
  /** Memories retained per end user; oldest are archived past this. */
  memoriesPerUser: number | null;
};

export const PLANS: Record<PlanName, PlanLimits> = {
  free: {
    label: "Free",
    monthlyWrites: 1_000,
    monthlyReads: 10_000,
    requestsPerMinute: 60,
    memoriesPerUser: 500,
  },
  starter: {
    label: "Starter",
    monthlyWrites: 25_000,
    monthlyReads: 250_000,
    requestsPerMinute: 300,
    memoriesPerUser: 5_000,
  },
  pro: {
    label: "Pro",
    monthlyWrites: 250_000,
    monthlyReads: 2_500_000,
    requestsPerMinute: 1_200,
    memoriesPerUser: 50_000,
  },
  enterprise: {
    label: "Enterprise",
    monthlyWrites: null,
    monthlyReads: null,
    requestsPerMinute: 6_000,
    memoriesPerUser: null,
  },
};

export function limitsFor(plan: PlanName): PlanLimits {
  return PLANS[plan] ?? PLANS.free;
}

/** First instant of the calendar month containing `now`, in UTC. */
export function billingPeriodStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Start of the fixed rate-limit window containing `now`. */
export function rateLimitWindowStart(now = new Date(), windowMs = 60_000): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

/** Seconds until the current window rolls over — the value for `Retry-After`. */
export function secondsUntilWindowReset(now = new Date(), windowMs = 60_000): number {
  const elapsed = now.getTime() - rateLimitWindowStart(now, windowMs).getTime();
  return Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
}

export type QuotaKind = "writes" | "reads";

export function quotaFor(plan: PlanName, kind: QuotaKind): number | null {
  const limits = limitsFor(plan);
  return kind === "writes" ? limits.monthlyWrites : limits.monthlyReads;
}

/** True when `used` has reached the plan's ceiling. Unlimited plans never do. */
export function isOverQuota(plan: PlanName, kind: QuotaKind, used: number): boolean {
  const quota = quotaFor(plan, kind);
  return quota !== null && used >= quota;
}
