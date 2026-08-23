import { CreditCard, ExternalLink, Receipt } from "lucide-react";
import { billingEnabled, purchasablePlans, type Invoice } from "@/lib/billing";
import { PLANS, type PlanLimits, type PlanName } from "@/lib/plans";
import { startCheckoutAction, openPortalAction } from "@/features/billing/actions/billing-actions";
import { Button } from "@/components/ui/button";
import { UsageBar } from "@/components/shared/usage-bar";
import { PageHeader } from "@/components/shared/page-header";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
    amount / 100
  );
}

const INVOICE_STATUS_TONE: Record<string, string> = {
  paid: "border-primary/30 bg-primary/10 text-primary",
  open: "border-border bg-muted text-foreground",
  uncollectible: "border-destructive/30 bg-destructive/10 text-destructive",
  void: "border-border bg-transparent text-muted-foreground",
};

function RecentInvoices({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Receipt className="size-3.5 text-muted-foreground" />
        <h2 className="text-sm font-medium text-foreground">Recent invoices</h2>
      </div>
      <ul className="divide-y divide-border">
        {invoices.map((invoice) => (
          <li key={invoice.id} className="flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">
                {invoice.number ?? invoice.id} · {invoice.createdAt.toLocaleDateString()}
              </p>
              <p className="text-xs text-muted-foreground">{formatMoney(invoice.amountPaid, invoice.currency)}</p>
            </div>
            {invoice.status && (
              <span
                className={`rounded-full border px-2 py-0.5 text-xs capitalize ${
                  INVOICE_STATUS_TONE[invoice.status] ?? INVOICE_STATUS_TONE.void
                }`}
              >
                {invoice.status}
              </span>
            )}
            {invoice.hostedInvoiceUrl && (
              <a
                href={invoice.hostedInvoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                View <ExternalLink className="size-3" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const COMPARISON_ROWS: { key: keyof PlanLimits; label: string; format: (v: PlanLimits) => string }[] = [
  { key: "monthlyWrites", label: "Writes / month", format: (p) => p.monthlyWrites?.toLocaleString() ?? "Unlimited" },
  { key: "monthlyReads", label: "Reads / month", format: (p) => p.monthlyReads?.toLocaleString() ?? "Unlimited" },
  { key: "requestsPerMinute", label: "Requests / min / key", format: (p) => p.requestsPerMinute.toLocaleString() },
  {
    key: "memoriesPerUser",
    label: "Memories / end user",
    format: (p) => p.memoriesPerUser?.toLocaleString() ?? "Unlimited",
  },
];

function PlanComparison({
  orgId,
  currentPlan,
  canManageBilling,
}: {
  orgId: string;
  currentPlan: PlanName;
  canManageBilling: boolean;
}) {
  const priceIds = new Map(purchasablePlans().map((o) => [o.plan, o.priceId]));
  const plans = Object.keys(PLANS) as PlanName[];

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="p-4 text-left font-medium text-muted-foreground"> </th>
            {plans.map((plan) => (
              <th key={plan} className="p-4 text-left">
                <span className="text-sm font-semibold text-foreground">{PLANS[plan].label}</span>
                {plan === currentPlan && (
                  <span className="ml-2 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    Current
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row) => (
            <tr key={row.key} className="border-b border-border last:border-0">
              <td className="p-4 text-muted-foreground">{row.label}</td>
              {plans.map((plan) => (
                <td key={plan} className="p-4 font-mono text-xs tabular-nums text-foreground">
                  {row.format(PLANS[plan])}
                </td>
              ))}
            </tr>
          ))}
          {canManageBilling && (
            <tr>
              <td className="p-4" />
              {plans.map((plan) => {
                const priceId = priceIds.get(plan);
                if (plan === currentPlan) return <td key={plan} className="p-4" />;
                return (
                  <td key={plan} className="p-4">
                    {priceId ? (
                      <form action={startCheckoutAction.bind(null, orgId, priceId)}>
                        <Button type="submit" size="sm">
                          Switch to {PLANS[plan].label}
                        </Button>
                      </form>
                    ) : plan === "enterprise" ? (
                      <span className="text-xs text-muted-foreground">Contact sales</span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function BillingPage({
  orgId,
  plan,
  subscriptionStatus,
  currentPeriodEnd,
  stripeCustomerId,
  limits,
  writes,
  reads,
  periodStart,
  canManageBilling,
  invoices,
}: {
  orgId: string;
  plan: PlanName;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  stripeCustomerId: string | null;
  limits: PlanLimits;
  writes: number;
  reads: number;
  periodStart: Date;
  /**
   * Roles exist now, so this is enforced rather than assumed: an admin runs the
   * team, an owner runs the money. Usage stays visible to everyone — knowing
   * how close the organization is to its quota is not a privilege.
   */
  canManageBilling: boolean;
  invoices: Invoice[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CreditCard}
        title="Billing"
        description="Usage this billing period, what your plan allows, and how to change it."
      />

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Current plan</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{limits.label}</p>
            {subscriptionStatus && subscriptionStatus !== "active" && (
              <p className="mt-1 text-sm text-status-warning">
                Subscription status: {subscriptionStatus.replace("_", " ")}
                {subscriptionStatus === "past_due" &&
                  " — your plan is still active while the payment is retried."}
              </p>
            )}
            {currentPeriodEnd && (
              <p className="mt-1 text-xs text-muted-foreground">
                Renews {currentPeriodEnd.toLocaleDateString()}
              </p>
            )}
          </div>

          {billingEnabled && canManageBilling && stripeCustomerId && (
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

      {!canManageBilling ? (
        <div className="rounded-lg border border-dashed border-border p-5">
          <p className="text-sm text-muted-foreground">
            Usage is visible to everyone in the organization. Changing the plan or the payment
            method is limited to owners.
          </p>
        </div>
      ) : !billingEnabled ? (
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
        <RecentInvoices invoices={invoices} />
      )}

      <PlanComparison orgId={orgId} currentPlan={plan} canManageBilling={canManageBilling && billingEnabled} />
    </div>
  );
}
