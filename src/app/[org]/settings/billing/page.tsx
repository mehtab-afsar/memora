import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { apiRequests } from "@/db/schema";
import { assertOrgAccess } from "@/features/auth/lib/dashboard-auth";
import { billingPeriodStart, limitsFor } from "@/lib/plans";
import { billingEnabled, listRecentInvoices, type Invoice } from "@/lib/billing";
import { can } from "@/lib/team";
import { BillingPage } from "@/features/billing/components/billing-page";

export default async function OrgBillingPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: orgId } = await params;
  const { org, role } = await assertOrgAccess(orgId);
  // Roles exist now, so this is enforced rather than assumed: an admin runs the
  // team, an owner runs the money.
  const canManageBilling = can(role, "manageBilling");

  const periodStart = billingPeriodStart();
  const countRequests = (kind: "writes" | "reads") =>
    db
      .select({ total: count() })
      .from(apiRequests)
      .where(
        and(eq(apiRequests.orgId, orgId), eq(apiRequests.kind, kind), gte(apiRequests.createdAt, periodStart))
      )
      .then(([row]) => row?.total ?? 0);
  const fetchInvoices = (): Promise<Invoice[]> =>
    !billingEnabled || !canManageBilling || !org.stripeCustomerId
      ? Promise.resolve([])
      : listRecentInvoices(org.stripeCustomerId);

  const [writes, reads, invoices] = await Promise.all([countRequests("writes"), countRequests("reads"), fetchInvoices()]);

  return (
    <BillingPage
      orgId={orgId}
      plan={org.plan}
      subscriptionStatus={org.subscriptionStatus}
      currentPeriodEnd={org.currentPeriodEnd}
      stripeCustomerId={org.stripeCustomerId}
      limits={limitsFor(org.plan)}
      writes={writes}
      reads={reads}
      periodStart={periodStart}
      canManageBilling={canManageBilling}
      invoices={invoices}
    />
  );
}
