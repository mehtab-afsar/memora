import { describe, expect, it } from "vitest";
import { can, canAssignRole, hashInvitationToken, normalizeEmail, type Role } from "@/lib/team";

/**
 * The database-touching parts (the last-owner guard, single-use acceptance) are
 * exercised by scripts/smoke-team.ts against a real Postgres, because what they
 * have to get right is transactional behaviour under concurrency — something a
 * mocked db cannot demonstrate.
 *
 * What is worth pinning down here is the permission table, because its failures
 * are silent: a role that can do one thing more than intended looks exactly like
 * a role that cannot.
 */

const ROLES: Role[] = ["owner", "admin", "member"];

describe("can", () => {
  it("gives members nothing beyond using the product", () => {
    expect(can("member", "invite")).toBe(false);
    expect(can("member", "remove")).toBe(false);
    expect(can("member", "changeRole")).toBe(false);
    expect(can("member", "manageBilling")).toBe(false);
    expect(can("member", "deleteOrg")).toBe(false);
  });

  it("lets admins run the team but not the money", () => {
    expect(can("admin", "invite")).toBe(true);
    expect(can("admin", "remove")).toBe(true);
    expect(can("admin", "changeRole")).toBe(true);
    // The whole point of the role split: an admin manages people, an owner
    // manages spend and existence.
    expect(can("admin", "manageBilling")).toBe(false);
    expect(can("admin", "deleteOrg")).toBe(false);
  });

  it("gives owners everything", () => {
    for (const capability of ["invite", "remove", "changeRole", "manageBilling", "deleteOrg"] as const) {
      expect(can("owner", capability)).toBe(true);
    }
  });
});

describe("canAssignRole", () => {
  it("stops an admin from minting an owner", () => {
    // Otherwise "admin" is "owner with an extra step" — promote yourself and
    // the billing and delete-org restrictions evaporate.
    expect(canAssignRole("admin", "owner")).toBe(false);
    expect(canAssignRole("admin", "admin")).toBe(true);
    expect(canAssignRole("admin", "member")).toBe(true);
  });

  it("lets an owner assign anything", () => {
    for (const role of ROLES) expect(canAssignRole("owner", role)).toBe(true);
  });

  it("lets a member assign nothing", () => {
    for (const role of ROLES) expect(canAssignRole("member", role)).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("makes invitations case- and whitespace-insensitive", () => {
    // The invited address is compared against the address someone signs in
    // with; a capital letter must not be the reason an invitation fails.
    expect(normalizeEmail("  Teammate@Company.COM ")).toBe("teammate@company.com");
  });
});

describe("hashInvitationToken", () => {
  it("is stable, so a link can be looked up", () => {
    expect(hashInvitationToken("abc")).toBe(hashInvitationToken("abc"));
  });

  it("does not contain the token", () => {
    // The raw token is the only credential in the emailed link; a database dump
    // must not hand over working invitations.
    expect(hashInvitationToken("secret-token")).not.toContain("secret-token");
    expect(hashInvitationToken("secret-token")).toMatch(/^[0-9a-f]{64}$/);
  });
});
