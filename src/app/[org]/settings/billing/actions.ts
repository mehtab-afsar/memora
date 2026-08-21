"use server";

import { redirect } from "next/navigation";
import { assertOrgAccess } from "@/lib/dashboard-auth";
import { createCheckoutSession, createPortalSession } from "@/lib/billing";
import { SITE_URL } from "@/lib/site";

export async function startCheckoutAction(orgId: string, priceId: string) {
  const { user } = await assertOrgAccess(orgId);
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
  await assertOrgAccess(orgId);
  const url = await createPortalSession(orgId, `${SITE_URL}/${orgId}/settings/billing`);
  redirect(url);
}
