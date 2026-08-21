"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/lib/session";
import { getMembershipForUser, renameOrg } from "@/lib/org";

export async function renameOrgAction(orgId: string, name: string) {
  const user = await requireUser();
  const membership = await getMembershipForUser(user.id, orgId);
  if (!membership) notFound();

  await renameOrg(orgId, name);
  revalidatePath(`/${orgId}/settings`);
}
