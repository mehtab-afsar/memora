"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/lib/session";
import { assertOrgAccess } from "@/features/auth/lib/dashboard-auth";
import { invitationEmail, sendEmail } from "@/lib/email";
import {
  acceptInvitation,
  changeRole,
  createInvitation,
  leaveOrg,
  removeMember,
  resendInvitation,
  revokeInvitation,
  TeamError,
  type Role,
} from "@/lib/team";

/**
 * Every action re-derives the caller's org membership and role from the
 * session. A Server Action is a POST endpoint with a nicer syntax: the org id
 * and membership id arrive as arguments and are entirely under the caller's
 * control, so being rendered by a page that already checked proves nothing.
 */

export type ActionResult = {
  error?: string;
  /** Shown when the invitation was created but could not be emailed. */
  inviteLink?: string;
  notice?: string;
};

async function baseUrl(): Promise<string> {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  // Falls back to the request's own host so a link generated on a preview
  // deployment points at that deployment rather than at localhost.
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${protocol}://${host}`;
}

function failed(error: unknown): ActionResult {
  // A TeamError is a message written for the person reading it. Anything else
  // is a bug, and its text is not something to put on a page.
  if (error instanceof TeamError) return { error: error.message };
  console.error("[team]", error);
  return { error: "Something went wrong. Please try again." };
}

export async function inviteMemberAction(
  orgId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const { user, org, role: actorRole } = await assertOrgAccess(orgId);

  try {
    const invitation = await createInvitation({
      orgId,
      email: String(formData.get("email") ?? ""),
      role: (String(formData.get("role") ?? "member") as Role),
      actorRole,
      invitedByUserId: user.id,
    });

    const link = `${await baseUrl()}/invite/${invitation.token}`;
    const result = await sendEmail({
      to: invitation.email,
      ...invitationEmail({
        orgName: org.name,
        inviterEmail: user.email ?? null,
        role: invitation.role,
        link,
      }),
    });

    revalidatePath(`/${orgId}/settings/team`);

    // The invitation is valid either way. If it could not be emailed, hand the
    // link back rather than reporting a success the recipient will never see.
    return result.sent
      ? { notice: `Invitation sent to ${invitation.email}.` }
      : { inviteLink: link, notice: `${result.reason} Send this link to ${invitation.email} yourself.` };
  } catch (error) {
    return failed(error);
  }
}

export async function resendInvitationAction(
  orgId: string,
  invitationId: string
): Promise<ActionResult> {
  const { user, org, role } = await assertOrgAccess(orgId);

  try {
    const { email, token } = await resendInvitation({ orgId, invitationId, actorRole: role });
    const link = `${await baseUrl()}/invite/${token}`;
    const result = await sendEmail({
      to: email,
      ...invitationEmail({ orgName: org.name, inviterEmail: user.email ?? null, role, link }),
    });

    revalidatePath(`/${orgId}/settings/team`);
    return result.sent
      ? { notice: `Invitation resent to ${email}.` }
      : { inviteLink: link, notice: `${result.reason} Send this link to ${email} yourself.` };
  } catch (error) {
    return failed(error);
  }
}

export async function revokeInvitationAction(orgId: string, invitationId: string): Promise<ActionResult> {
  const { role } = await assertOrgAccess(orgId);
  try {
    await revokeInvitation({ orgId, invitationId, actorRole: role });
    revalidatePath(`/${orgId}/settings/team`);
    return { notice: "Invitation revoked." };
  } catch (error) {
    return failed(error);
  }
}

export async function changeRoleAction(
  orgId: string,
  membershipId: string,
  role: Role
): Promise<ActionResult> {
  const { user, role: actorRole } = await assertOrgAccess(orgId);
  try {
    await changeRole({ orgId, membershipId, role, actorRole, actorUserId: user.id });
    revalidatePath(`/${orgId}/settings/team`);
    return { notice: "Role updated." };
  } catch (error) {
    return failed(error);
  }
}

export async function removeMemberAction(orgId: string, membershipId: string): Promise<ActionResult> {
  const { user, role: actorRole } = await assertOrgAccess(orgId);
  try {
    await removeMember({ orgId, membershipId, actorRole, actorUserId: user.id });
    revalidatePath(`/${orgId}/settings/team`);
    return { notice: "Member removed." };
  } catch (error) {
    return failed(error);
  }
}

export async function leaveOrgAction(orgId: string): Promise<ActionResult> {
  const { user } = await assertOrgAccess(orgId);
  try {
    await leaveOrg({ orgId, userId: user.id });
  } catch (error) {
    return failed(error);
  }
  redirect("/");
}

/**
 * Accepting is a POST, and deliberately not a GET — see `previewInvitation` in
 * src/lib/team.ts for why a link that is accepted by being fetched is a link
 * that email security scanners consume before the recipient sees it.
 */
export async function acceptInvitationAction(token: string): Promise<ActionResult> {
  const user = await requireUser();

  let orgId: string;
  try {
    const result = await acceptInvitation({ token, userId: user.id, userEmail: user.email ?? "" });
    orgId = result.orgId;
  } catch (error) {
    return failed(error);
  }

  redirect(`/${orgId}/settings/team`);
}
