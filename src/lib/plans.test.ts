import { describe, expect, it } from "vitest";
import {
  billingPeriodStart,
  isOverQuota,
  limitsFor,
  PLANS,
  quotaFor,
  rateLimitWindowStart,
  secondsUntilWindowReset,
} from "@/lib/plans";
import { hashRequest, hasScope } from "@/lib/guards";

describe("plan limits", () => {
  it("gets stricter as plans get cheaper", () => {
    const order = ["free", "starter", "pro"] as const;
    for (let i = 1; i < order.length; i++) {
      const lower = limitsFor(order[i - 1]);
      const higher = limitsFor(order[i]);
      expect(higher.requestsPerMinute).toBeGreaterThan(lower.requestsPerMinute);
      expect(higher.monthlyWrites!).toBeGreaterThan(lower.monthlyWrites!);
      expect(higher.monthlyReads!).toBeGreaterThan(lower.monthlyReads!);
    }
  });

  it("leaves enterprise uncapped but still rate limited", () => {
    expect(PLANS.enterprise.monthlyWrites).toBeNull();
    expect(PLANS.enterprise.monthlyReads).toBeNull();
    // Unlimited spend is a business decision; unlimited requests per second is
    // an outage, so even enterprise keeps a ceiling.
    expect(PLANS.enterprise.requestsPerMinute).toBeGreaterThan(0);
  });

  it("allows more reads than writes on every plan — writes are what cost money", () => {
    for (const plan of ["free", "starter", "pro"] as const) {
      expect(limitsFor(plan).monthlyReads!).toBeGreaterThan(limitsFor(plan).monthlyWrites!);
    }
  });

  it("falls back to the free plan for an unknown name", () => {
    expect(limitsFor("nonsense" as "free")).toBe(PLANS.free);
  });
});

describe("quota", () => {
  it("blocks at the ceiling, not one past it", () => {
    const quota = quotaFor("free", "writes")!;
    expect(isOverQuota("free", "writes", quota - 1)).toBe(false);
    expect(isOverQuota("free", "writes", quota)).toBe(true);
  });

  it("never blocks an unlimited plan", () => {
    expect(isOverQuota("enterprise", "writes", 10_000_000)).toBe(false);
    expect(quotaFor("enterprise", "reads")).toBeNull();
  });
});

describe("billing period", () => {
  it("starts at the first instant of the UTC month", () => {
    const start = billingPeriodStart(new Date("2026-08-20T17:45:03.123Z"));
    expect(start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("does not drift across a year boundary", () => {
    expect(billingPeriodStart(new Date("2027-01-01T00:00:00Z")).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z"
    );
    expect(billingPeriodStart(new Date("2026-12-31T23:59:59Z")).toISOString()).toBe(
      "2026-12-01T00:00:00.000Z"
    );
  });
});

describe("rate limit window", () => {
  it("buckets a minute to its start", () => {
    expect(rateLimitWindowStart(new Date("2026-08-20T17:45:59.999Z")).toISOString()).toBe(
      "2026-08-20T17:45:00.000Z"
    );
    expect(rateLimitWindowStart(new Date("2026-08-20T17:46:00.000Z")).toISOString()).toBe(
      "2026-08-20T17:46:00.000Z"
    );
  });

  it("reports the seconds left in the window, never zero", () => {
    expect(secondsUntilWindowReset(new Date("2026-08-20T17:45:00.000Z"))).toBe(60);
    expect(secondsUntilWindowReset(new Date("2026-08-20T17:45:30.000Z"))).toBe(30);
    // A caller told to retry in zero seconds retries immediately and is
    // rejected again.
    expect(secondsUntilWindowReset(new Date("2026-08-20T17:45:59.999Z"))).toBe(1);
  });
});

describe("scopes", () => {
  it("grants only what the key holds", () => {
    expect(hasScope(["read"], "read")).toBe(true);
    expect(hasScope(["read"], "write")).toBe(false);
    expect(hasScope(["read", "write"], "write")).toBe(true);
    expect(hasScope([], "read")).toBe(false);
  });
});

describe("idempotency request hashing", () => {
  it("is stable for the same request", () => {
    const a = hashRequest("POST", "/api/v1/memories/remember", '{"user_id":"u"}');
    const b = hashRequest("POST", "/api/v1/memories/remember", '{"user_id":"u"}');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when the body, path or method changes", () => {
    const base = hashRequest("POST", "/api/v1/memories/remember", '{"user_id":"u"}');
    expect(hashRequest("POST", "/api/v1/memories/remember", '{"user_id":"v"}')).not.toBe(base);
    expect(hashRequest("POST", "/api/v1/experiences/record", '{"user_id":"u"}')).not.toBe(base);
    expect(hashRequest("PATCH", "/api/v1/memories/remember", '{"user_id":"u"}')).not.toBe(base);
  });
});
