import { loadEnv, requireEnv } from "../evals/env";

/**
 * Exercises team membership against a real database.
 *
 *   pnpm smoke:team
 *
 * The claims worth checking here are transactional, not logical: that an
 * invitation can only be accepted once even if two clicks race, that the last
 * owner cannot be removed or demoted, and that a link cannot be redeemed by
 * whoever happens to be holding it. None of those can be demonstrated against a
 * mock — they are properties of the transaction and the constraint.
 */

async function main() {
  loadEnv();
  requireEnv("DATABASE_URL");

  const { eq, and } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const { organizations, users, memberships, invitations } = await import("@/db/schema");
  const team = await import("@/lib/team");

  let failures = 0;
  const check = (label: string, ok: boolean, detail = "") => {
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
  };

  const expectError = async (label: string, fn: () => Promise<unknown>, fragment: string) => {
    try {
      await fn();
      check(label, false, "no error was thrown");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      check(label, message.toLowerCase().includes(fragment.toLowerCase()), message);
    }
  };

  const stamp = Date.now();
  const [org] = await db.insert(organizations).values({ name: `team-${stamp}` }).returning();
  const mkUser = async (label: string) => {
    const [user] = await db
      .insert(users)
      .values({ email: `${label}-${stamp}@example.com`, passwordHash: "x", name: label })
      .returning();
    return user;
  };

  try {
    console.log(`\nTeam smoke test on ${new URL(process.env.DATABASE_URL!).hostname}\n`);

    const owner = await mkUser("owner");
    const invitee = await mkUser("invitee");
    const stranger = await mkUser("stranger");
    const [ownerMembership] = await db
      .insert(memberships)
      .values({ orgId: org.id, userId: owner.id, role: "owner" })
      .returning();

    // --- the last owner ------------------------------------------------------
    await expectError(
      "the only owner cannot be removed",
      () => team.removeMember({ orgId: org.id, membershipId: ownerMembership.id, actorRole: "owner", actorUserId: owner.id }),
      "only owner"
    );
    await expectError(
      "the only owner cannot be demoted",
      () => team.changeRole({ orgId: org.id, membershipId: ownerMembership.id, role: "member", actorRole: "owner", actorUserId: owner.id }),
      "only owner"
    );
    await expectError(
      "the only owner cannot leave",
      () => team.leaveOrg({ orgId: org.id, userId: owner.id }),
      "only owner"
    );

    // --- permissions ---------------------------------------------------------
    await expectError(
      "a member cannot invite",
      () => team.createInvitation({ orgId: org.id, email: "x@example.com", role: "member", actorRole: "member", invitedByUserId: owner.id }),
      "permission"
    );
    await expectError(
      "an admin cannot invite an owner",
      () => team.createInvitation({ orgId: org.id, email: "x@example.com", role: "owner", actorRole: "admin", invitedByUserId: owner.id }),
      "only an owner"
    );

    // --- the invitation ------------------------------------------------------
    const invitation = await team.createInvitation({
      orgId: org.id,
      email: invitee.email,
      role: "member",
      actorRole: "owner",
      invitedByUserId: owner.id,
    });
    check("an invitation is created", Boolean(invitation.token));

    const [stored] = await db.select().from(invitations).where(eq(invitations.id, invitation.id));
    check("the raw token is not stored", !JSON.stringify(stored).includes(invitation.token));

    const preview = await team.previewInvitation(invitation.token);
    check("previewing shows the invitation", preview?.email === invitee.email);
    const [afterPreview] = await db.select().from(invitations).where(eq(invitations.id, invitation.id));
    // The reason accepting is a POST: a mail scanner fetching the link must not
    // consume the invitation before its recipient ever sees it.
    check("previewing does NOT consume it", afterPreview.status === "pending", afterPreview.status);

    await expectError(
      "someone else's link cannot be redeemed",
      () => team.acceptInvitation({ token: invitation.token, userId: stranger.id, userEmail: stranger.email }),
      "was sent to"
    );

    // --- concurrent acceptance ----------------------------------------------
    const results = await Promise.allSettled([
      team.acceptInvitation({ token: invitation.token, userId: invitee.id, userEmail: invitee.email }),
      team.acceptInvitation({ token: invitation.token, userId: invitee.id, userEmail: invitee.email }),
    ]);
    const accepted = results.filter((r) => r.status === "fulfilled").length;
    check("two simultaneous accepts produce exactly one", accepted === 1, `${accepted} succeeded`);

    const members = await team.listMembers(org.id);
    check("the invitee is now a member", members.length === 2, `${members.length} members`);

    await expectError(
      "a used invitation cannot be reused",
      () => team.acceptInvitation({ token: invitation.token, userId: invitee.id, userEmail: invitee.email }),
      "already been used"
    );

    // --- revocation ----------------------------------------------------------
    const second = await team.createInvitation({
      orgId: org.id, email: `later-${stamp}@example.com`, role: "admin", actorRole: "owner", invitedByUserId: owner.id,
    });
    await team.revokeInvitation({ orgId: org.id, invitationId: second.id, actorRole: "owner" });
    check("a revoked invitation no longer previews", (await team.previewInvitation(second.token)) === null);

    // --- resend rotates the token --------------------------------------------
    const third = await team.createInvitation({
      orgId: org.id, email: `resend-${stamp}@example.com`, role: "member", actorRole: "owner", invitedByUserId: owner.id,
    });
    const resent = await team.resendInvitation({ orgId: org.id, invitationId: third.id, actorRole: "owner" });
    check("resending invalidates the old link", (await team.previewInvitation(third.token)) === null);
    check("resending issues a working link", (await team.previewInvitation(resent.token)) !== null);

    // --- re-inviting supersedes ----------------------------------------------
    const first = await team.createInvitation({
      orgId: org.id, email: `dup-${stamp}@example.com`, role: "member", actorRole: "owner", invitedByUserId: owner.id,
    });
    await team.createInvitation({
      orgId: org.id, email: `dup-${stamp}@example.com`, role: "admin", actorRole: "owner", invitedByUserId: owner.id,
    });
    check("re-inviting revokes the earlier link", (await team.previewInvitation(first.token)) === null);
    const pending = await team.listPendingInvitations(org.id);
    const dupes = pending.filter((p) => p.email === `dup-${stamp}@example.com`);
    check("only one pending invitation per address", dupes.length === 1, `${dupes.length}`);

    await expectError(
      "an existing member cannot be re-invited",
      () => team.createInvitation({ orgId: org.id, email: invitee.email, role: "member", actorRole: "owner", invitedByUserId: owner.id }),
      "already in this organization"
    );

    // --- now that a second member exists, the owner can hand over ------------
    const inviteeMembership = members.find((m) => m.userId === invitee.id)!;
    await team.changeRole({ orgId: org.id, membershipId: inviteeMembership.membershipId, role: "owner", actorRole: "owner", actorUserId: owner.id });
    await team.removeMember({ orgId: org.id, membershipId: ownerMembership.id, actorRole: "owner", actorUserId: owner.id });
    const remaining = await team.listMembers(org.id);
    check("an owner can leave once another owner exists", remaining.length === 1 && remaining[0].role === "owner");

    // --- an admin cannot touch an owner --------------------------------------
    const adminUser = await mkUser("admin");
    const [adminMembership] = await db
      .insert(memberships)
      .values({ orgId: org.id, userId: adminUser.id, role: "admin" })
      .returning();
    void adminMembership;
    await expectError(
      "an admin cannot remove an owner",
      () => team.removeMember({ orgId: org.id, membershipId: remaining[0].membershipId, actorRole: "admin", actorUserId: adminUser.id }),
      "only an owner"
    );

    // --- deleting the org takes its invitations with it ----------------------
    const [before] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(and(eq(invitations.orgId, org.id), eq(invitations.status, "pending")))
      .limit(1);
    check("pending invitations exist before cleanup", Boolean(before));
  } finally {
    await db.delete(organizations).where(eq(organizations.id, org.id));
    const leftover = await db.select({ id: invitations.id }).from(invitations).where(eq(invitations.orgId, org.id));
    check("deleting the org removes its invitations", leftover.length === 0, `${leftover.length} left`);
    // The user rows are not org-scoped, so they need removing explicitly.
    const { like } = await import("drizzle-orm");
    await db.delete(users).where(like(users.email, `%-${stamp}@example.com`));
  }

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
