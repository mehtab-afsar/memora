import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { invitations, memberships, organizations, users } from "@/db/schema";

/**
 * Team membership: who is in an organization, and who may change that.
 *
 * The rules that matter are in `can()` and in the last-owner guard. Everything
 * else is bookkeeping.
 */

export type Role = "owner" | "admin" | "member";

/**
 * Either the database or an open transaction. The guards below have to run
 * inside the same transaction as the change they guard, or a concurrent
 * demotion and removal could each observe two owners and leave zero.
 */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** How long an invitation link stays usable. */
export const INVITATION_TTL_DAYS = 7;

/**
 * What each role may do.
 *
 * Written as a table rather than scattered `if (role === "owner")` checks,
 * because the interesting failures here are omissions — a route nobody
 * remembered to guard — and a table makes the gaps visible.
 */
const CAPABILITIES = {
  owner: ["invite", "remove", "changeRole", "manageBilling", "deleteOrg"],
  admin: ["invite", "remove", "changeRole"],
  member: [],
} as const satisfies Record<Role, readonly string[]>;

export type Capability = (typeof CAPABILITIES)["owner"][number];

export function can(role: Role, capability: Capability): boolean {
  return (CAPABILITIES[role] as readonly string[]).includes(capability);
}

/**
 * Whether `actor` may assign `target` as a role.
 *
 * An admin can invite and manage members and other admins, but cannot mint an
 * owner. Otherwise "admin" would be "owner with an extra step": promote
 * yourself, and the billing and delete-organization restrictions evaporate.
 */
export function canAssignRole(actor: Role, target: Role): boolean {
  if (!can(actor, "changeRole")) return false;
  return actor === "owner" || target !== "owner";
}

export class TeamError extends Error {}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export async function listMembers(orgId: string) {
  return db
    .select({
      membershipId: memberships.id,
      userId: users.id,
      email: users.email,
      name: users.name,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.orgId, orgId))
    .orderBy(asc(memberships.createdAt));
}

export async function listPendingInvitations(orgId: string) {
  return db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      createdAt: invitations.createdAt,
      expiresAt: invitations.expiresAt,
      sentCount: invitations.sentCount,
      invitedByEmail: users.email,
    })
    .from(invitations)
    .leftJoin(users, eq(invitations.invitedByUserId, users.id))
    .where(and(eq(invitations.orgId, orgId), eq(invitations.status, "pending")))
    .orderBy(desc(invitations.createdAt));
}

async function countOwners(orgId: string, tx: Executor = db): Promise<number> {
  const [row] = await tx
    .select({ total: sql<number>`count(*)::int` })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.role, "owner")));
  return row?.total ?? 0;
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

/**
 * Hashed at rest, like an API key. The raw token lives in the emailed link and
 * nowhere else.
 */
export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type CreatedInvitation = {
  id: string;
  email: string;
  role: Role;
  /** Only ever returned here — it is not recoverable from the database. */
  token: string;
  expiresAt: Date;
};

export async function createInvitation(params: {
  orgId: string;
  email: string;
  role: Role;
  actorRole: Role;
  invitedByUserId: string;
}): Promise<CreatedInvitation> {
  const email = normalizeEmail(params.email);
  if (!email.includes("@")) throw new TeamError("That does not look like an email address.");
  if (!can(params.actorRole, "invite")) throw new TeamError("You do not have permission to invite people.");
  if (!canAssignRole(params.actorRole, params.role)) {
    throw new TeamError("Only an owner can invite another owner.");
  }

  // Already a member? Say so plainly rather than sending a link that would
  // fail confusingly at the other end.
  const [existing] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(memberships.orgId, params.orgId), eq(users.email, email)))
    .limit(1);
  if (existing) throw new TeamError("That person is already in this organization.");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  return db.transaction(async (tx) => {
    // Re-inviting supersedes any live invitation rather than creating a second
    // one, so the member list never shows the same address twice and the older
    // link stops working.
    await tx
      .update(invitations)
      .set({ status: "revoked" })
      .where(
        and(
          eq(invitations.orgId, params.orgId),
          eq(invitations.email, email),
          eq(invitations.status, "pending")
        )
      );

    const [row] = await tx
      .insert(invitations)
      .values({
        orgId: params.orgId,
        email,
        role: params.role,
        tokenHash: hashInvitationToken(token),
        invitedByUserId: params.invitedByUserId,
        expiresAt,
      })
      .returning();

    return { id: row.id, email, role: params.role, token, expiresAt };
  });
}

export type InvitationPreview = {
  id: string;
  email: string;
  role: Role;
  orgName: string;
  invitedByEmail: string | null;
  expiresAt: Date;
};

/**
 * Looks an invitation up **without consuming it**.
 *
 * This is the whole reason accepting is a POST and viewing is a GET. Corporate
 * mail scanners follow links in email before a human ever clicks; an invitation
 * that is accepted by a GET is an invitation routinely burned by a security
 * appliance, and the recipient sees "this link has already been used". Reading
 * is safe, acting is not, and HTTP already has that distinction.
 */
export async function previewInvitation(token: string): Promise<InvitationPreview | null> {
  const [row] = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
      orgName: organizations.name,
      invitedByEmail: users.email,
    })
    .from(invitations)
    .innerJoin(organizations, eq(invitations.orgId, organizations.id))
    .leftJoin(users, eq(invitations.invitedByUserId, users.id))
    .where(eq(invitations.tokenHash, hashInvitationToken(token)))
    .limit(1);

  if (!row || row.status !== "pending" || row.expiresAt.getTime() < Date.now()) return null;

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    orgName: row.orgName,
    invitedByEmail: row.invitedByEmail,
    expiresAt: row.expiresAt,
  };
}

/**
 * Turns an invitation into a membership. Single-use: the status change and the
 * membership insert happen in one transaction, and the update is conditional on
 * the row still being pending, so two simultaneous clicks produce one member.
 */
export async function acceptInvitation(params: {
  token: string;
  userId: string;
  userEmail: string;
}): Promise<{ orgId: string }> {
  const tokenHash = hashInvitationToken(params.token);

  return db.transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, tokenHash))
      .limit(1);

    if (!invitation) throw new TeamError("This invitation link is not valid.");
    if (invitation.status === "accepted") throw new TeamError("This invitation has already been used.");
    if (invitation.status === "revoked") throw new TeamError("This invitation was revoked.");
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new TeamError("This invitation has expired. Ask for a new one.");
    }

    // The link is the only secret, so anyone holding it could otherwise join as
    // themselves — a forwarded email, a leaked inbox, a shared screen. Binding
    // acceptance to the invited address means a stolen link is useless without
    // also controlling that mailbox.
    if (normalizeEmail(params.userEmail) !== invitation.email) {
      throw new TeamError(
        `This invitation was sent to ${invitation.email}. Sign in with that address to accept it.`
      );
    }

    const [claimed] = await tx
      .update(invitations)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(and(eq(invitations.id, invitation.id), eq(invitations.status, "pending")))
      .returning({ id: invitations.id });
    if (!claimed) throw new TeamError("This invitation has already been used.");

    await tx
      .insert(memberships)
      .values({ orgId: invitation.orgId, userId: params.userId, role: invitation.role });

    return { orgId: invitation.orgId };
  });
}

export async function revokeInvitation(params: { orgId: string; invitationId: string; actorRole: Role }) {
  if (!can(params.actorRole, "invite")) throw new TeamError("You do not have permission to do that.");
  await db
    .update(invitations)
    .set({ status: "revoked" })
    .where(
      and(
        eq(invitations.id, params.invitationId),
        eq(invitations.orgId, params.orgId),
        eq(invitations.status, "pending")
      )
    );
}

/**
 * Issues a fresh token for an existing invitation. The old link stops working,
 * which is the point: a resend usually means the first link went astray.
 */
export async function resendInvitation(params: {
  orgId: string;
  invitationId: string;
  actorRole: Role;
}): Promise<{ email: string; token: string }> {
  if (!can(params.actorRole, "invite")) throw new TeamError("You do not have permission to do that.");

  const token = randomBytes(32).toString("base64url");
  const [row] = await db
    .update(invitations)
    .set({
      tokenHash: hashInvitationToken(token),
      expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
      sentCount: sql`${invitations.sentCount} + 1`,
    })
    .where(
      and(
        eq(invitations.id, params.invitationId),
        eq(invitations.orgId, params.orgId),
        eq(invitations.status, "pending")
      )
    )
    .returning({ email: invitations.email });

  if (!row) throw new TeamError("That invitation is no longer pending.");
  return { email: row.email, token };
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

/**
 * The last owner cannot be demoted or removed.
 *
 * Without this an organization can be left with nobody able to manage billing,
 * invite anyone, or delete it — a state no one in the product can repair, only
 * an operator with database access. It is worth one extra query.
 */
async function assertNotLastOwner(orgId: string, membershipId: string, tx: Executor = db) {
  const [target] = await tx
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.id, membershipId), eq(memberships.orgId, orgId)))
    .limit(1);
  if (!target) throw new TeamError("That person is not in this organization.");
  if (target.role !== "owner") return;
  if ((await countOwners(orgId, tx)) <= 1) {
    throw new TeamError("This is the only owner. Make someone else an owner first.");
  }
}

export async function changeRole(params: {
  orgId: string;
  membershipId: string;
  role: Role;
  actorRole: Role;
  actorUserId: string;
}) {
  if (!canAssignRole(params.actorRole, params.role)) {
    throw new TeamError("You do not have permission to assign that role.");
  }

  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ role: memberships.role, userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.id, params.membershipId), eq(memberships.orgId, params.orgId)))
      .limit(1);
    if (!target) throw new TeamError("That person is not in this organization.");

    // An admin may manage members and other admins, but not an owner —
    // otherwise the role above them is not actually above them.
    if (target.role === "owner" && params.actorRole !== "owner") {
      throw new TeamError("Only an owner can change another owner's role.");
    }
    if (target.role !== params.role) await assertNotLastOwner(params.orgId, params.membershipId, tx);

    await tx.update(memberships).set({ role: params.role }).where(eq(memberships.id, params.membershipId));
  });
}

export async function removeMember(params: {
  orgId: string;
  membershipId: string;
  actorRole: Role;
  actorUserId: string;
}) {
  if (!can(params.actorRole, "remove")) throw new TeamError("You do not have permission to do that.");

  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ role: memberships.role, userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.id, params.membershipId), eq(memberships.orgId, params.orgId)))
      .limit(1);
    if (!target) throw new TeamError("That person is not in this organization.");
    if (target.role === "owner" && params.actorRole !== "owner") {
      throw new TeamError("Only an owner can remove an owner.");
    }

    await assertNotLastOwner(params.orgId, params.membershipId, tx);
    await tx.delete(memberships).where(eq(memberships.id, params.membershipId));
  });
}

/** Leaving is removing yourself, and runs into the same last-owner guard. */
export async function leaveOrg(params: { orgId: string; userId: string }) {
  const [membership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.orgId, params.orgId), eq(memberships.userId, params.userId)))
    .limit(1);
  if (!membership) throw new TeamError("You are not in this organization.");

  await db.transaction(async (tx) => {
    await assertNotLastOwner(params.orgId, membership.id, tx);
    await tx.delete(memberships).where(eq(memberships.id, membership.id));
  });
}

/** Other organizations this user belongs to — for the org switcher. */
export async function listOrgsForUser(userId: string) {
  return db
    .select({ id: organizations.id, name: organizations.name, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt));
}
