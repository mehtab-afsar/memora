import { and, count, eq, gte } from "drizzle-orm";
import { CreditCard, ExternalLink } from "lucide-react";
import { db } from "@/db";
import { apiRequests } from "@/db/schema";
import { assertOrgAccess } from "@/lib/dashboard-auth";
import { billingEnabled, purchasablePlans } from "@/lib/billing";
import { PLANS, billingPeriodStart, limitsFor } from "@/lib/plans";
import { startCheckoutAction, openPortalAction } from "@/app/[org]/settings/billing/actions";
import { Button } from "@/components/ui/button";

function UsageBar({ label, used, quota }: { label: string; used: number; quota: number | null }) {
  const pct = quota === null ? 0 : Math.min(100, Math.round((used / quota) * 100));
  // Amber at 80% rather than only red at 100%: a customer should find out they
  // are running out before the API starts refusing them, not after.
  const color = pct >= 100 ? "var(--status-critical)" : pct >= 80 ? "var(--status-warning)" : "var(--primary)";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-xs tabular-nums text-foreground">
          {used.toLocaleString()} {quota === null ? "" : `/ ${quota.toLocaleString()}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default async function BillingPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: orgId } = await params;
  const { org } = await assertOrgAccess(orgId);

  const periodStart = billingPeriodStart();
  const [writes, reads] = await Promise.all(
    (["writes", "reads"] as const).map(async (kind) => {
      const [row] = await db
        .select({ total: count() })
        .from(apiRequests)
        .where(
          and(
            eq(apiRequests.orgId, orgId),
            eq(apiRequests.kind, kind),
            gte(apiRequests.createdAt, periodStart)
          )
        );
      return row?.total ?? 0;
    })
  );

  const limits = limitsFor(org.plan);
  const offers = purchasablePlans().filter((o) => o.plan !== org.plan);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Usage this billing period, and what your plan allows.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Current plan</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{limits.label}</p>
            {org.subscriptionStatus && org.subscriptionStatus !== "active" && (
              <p className="mt-1 text-sm text-status-warning">
                Subscription status: {org.subscriptionStatus.replace("_", " ")}
                {org.subscriptionStatus === "past_due" &&
                  " — your plan is still active while the payment is retried."}
              </p>
            )}
            {org.currentPeriodEnd && (
              <p className="mt-1 text-xs text-muted-foreground">
                Renews {org.currentPeriodEnd.toLocaleDateString()}
              </p>
            )}
          </div>

          {billingEnabled && org.stripeCustomerId && (
            <form action={openPortalAction.bind(null, orgId)}>
              <Button type="submit" variant="outline" className="gap-1.5">
                <CreditCard className="size-3.5" />
                Manage billing
                <ExternalLink className="size-3" />
              </Button>
            </form>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-4 border-t border-border pt-5">
          <UsageBar label="Writes this month" used={writes} quota={limits.monthlyWrites} />
          <UsageBar label="Reads this month" used={reads} quota={limits.monthlyReads} />
          <p className="text-xs text-muted-foreground">
            Resets {new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1).toLocaleDateString()}.
            Rate limit: {limits.requestsPerMinute.toLocaleString()} requests per minute per key.
          </p>
        </div>
      </div>

      {!billingEnabled ? (
        <div className="rounded-lg border border-dashed border-border p-5">
          <p className="text-sm font-medium text-foreground">Billing is not configured</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Quotas and rate limits are enforced, but nothing can be purchased. Set{" "}
            <code className="font-mono text-xs">STRIPE_SECRET_KEY</code>,{" "}
            <code className="font-mono text-xs">STRIPE_WEBHOOK_SECRET</code> and the plan price ids
            to enable upgrades. See <span className="font-mono text-xs">docs/billing.md</span>.
          </p>
        </div>
      ) : (
        offers.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {offers.map((offer) => {
              const plan = PLANS[offer.plan];
              return (
                <div key={offer.plan} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
                  <div>
                    <p className="text-base font-semibold text-foreground">{plan.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {plan.monthlyWrites?.toLocaleString() ?? "Unlimited"} writes and{" "}
                      {plan.monthlyReads?.toLocaleString() ?? "unlimited"} reads a month.
                    </p>
                  </div>
                  <form action={startCheckoutAction.bind(null, orgId, offer.priceId)} className="mt-auto">
                    <Button type="submit" className="w-full">
                      Upgrade to {plan.label}
                    </Button>
                  </form>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
