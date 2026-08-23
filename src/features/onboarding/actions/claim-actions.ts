"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/lib/session";
import { acceptOrgClaim, getFirstProjectForOrg, OrgError } from "@/lib/org";

export type ClaimActionResult = { error?: string };

/**
 * Mirrors `acceptInvitationAction` in src/features/team/actions/team-actions.ts:
 * `redirect()` throws a Next.js control-flow signal, so it must happen
 * outside the try/catch — a wrapping catch would otherwise swallow it and
 * report a successful claim as a failure.
 */
export async function acceptOrgClaimAction(token: string): Promise<ClaimActionResult | void> {
  const user = await requireUser();

  let orgId: string;
  try {
    ({ orgId } = await acceptOrgClaim({ token, userId: user.id }));
  } catch (error) {
    if (error instanceof OrgError) return { error: error.message };
    console.error("[claim]", error);
    return { error: "Something went wrong. Please try again." };
  }

  const project = await getFirstProjectForOrg(orgId);
  redirect(project ? `/${orgId}/${project.id}/overview` : `/${orgId}`);
}
