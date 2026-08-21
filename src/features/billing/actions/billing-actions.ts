"use server";

import { redirect } from "next/navigation";
import { assertOrgAccess } from "@/features/auth/lib/dashboard-auth";
import { createCheckoutSession, createPortalSession } from "@/lib/billing";
import { SITE_URL } from "@/lib/site";
import { can } from "@/lib/team";

/**
 * Both actions are owner-only, enforced here rather than only in the UI. A
 * Server Action is a POST endpoint: hiding a button stops nobody who can read
 * the page source, and either of these spends the organization's money.
 */
function assertMayBill(role: Parameters<typeof can>[0]) {
  if (!can(role, "manageBilling")) {
    throw new Error("Only an owner can change this organization's plan or payment method.");
  }
}

export async function startCheckoutAction(orgId: string, priceId: string) {
  const { user, role } = await assertOrgAccess(orgId);
  assertMayBill(role);
  if (!user.email) throw new Error("Your account has no email address to bill against");

  const url = await createCheckoutSession({
    orgId,
    email: user.email,
    priceId,
    returnUrl: `${SITE_URL}/${orgId}/settings/billing`,
  });
  redirect(url);
}

export async function openPortalAction(orgId: string) {
  const { role } = await assertOrgAccess(orgId);
  assertMayBill(role);
  const url = await createPortalSession(orgId, `${SITE_URL}/${orgId}/settings/billing`);
  redirect(url);
}
