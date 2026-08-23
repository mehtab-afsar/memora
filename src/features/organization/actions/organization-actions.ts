"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertOrgAccess } from "@/features/auth/lib/dashboard-auth";
import { renameOrg } from "@/lib/org";
import { deleteOrganization, TeamError } from "@/lib/team";

export type OrgActionResult = { error?: string };

export async function renameOrgAction(orgId: string, name: string) {
  await assertOrgAccess(orgId);
  await renameOrg(orgId, name);
  revalidatePath(`/${orgId}/settings`);
}

export async function deleteOrgAction(orgId: string): Promise<OrgActionResult> {
  const { role } = await assertOrgAccess(orgId);

  try {
    await deleteOrganization({ orgId, actorRole: role });
  } catch (error) {
    if (error instanceof TeamError) return { error: error.message };
    console.error("[organization]", error);
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/onboarding");
}
