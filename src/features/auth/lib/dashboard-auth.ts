import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/lib/session";
import { getMembershipForUser, getProjectInOrg } from "@/lib/org";
import type { Role } from "@/lib/team";

/**
 * Re-derives and re-checks org/project access from scratch — used by both
 * dashboard pages and Server Actions. Server Actions are effectively exposed
 * POST endpoints; an org/project id passed as an action argument must be
 * re-validated against the *current* session on every call, not trusted
 * because the page that rendered the button already checked once.
 */
export async function assertOrgAccess(orgId: string) {
  const user = await requireUser();

  const membership = await getMembershipForUser(user.id, orgId);
  if (!membership) notFound();

  // The role comes back with the access check rather than being fetched
  // separately, so there is no way to check membership and then forget to
  // check what that membership is allowed to do.
  return { user, org: membership.org, role: membership.membership.role as Role };
}

export async function assertProjectAccess(orgId: string, projectId: string) {
  const user = await requireUser();

  const membership = await getMembershipForUser(user.id, orgId);
  if (!membership) notFound();

  const project = await getProjectInOrg(orgId, projectId);
  if (!project) notFound();

  return { user, org: membership.org, role: membership.membership.role as Role, project };
}
