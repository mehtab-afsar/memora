import { createHash, randomBytes } from "node:crypto";
import { and, asc, count, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  organizations,
  memberships,
  projects,
  environments,
  apiKeys,
  apiRequests,
  orgClaimTokens,
} from "@/db/schema";
import { generateApiKey } from "@/lib/api-keys";

export class OrgError extends Error {}

/** How long an agent-provisioned org's claim link stays usable. Matches `INVITATION_TTL_DAYS` in src/lib/team.ts. */
export const AGENT_CLAIM_TTL_DAYS = 7;

export type ApiKeyScope = "read" | "write";

/** Single-owner-per-org for v1: a user's first membership is their org. */
export async function getCurrentOrgForUser(userId: string) {
  const [row] = await db
    .select({ org: organizations })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(eq(memberships.userId, userId))
    .limit(1);
  return row?.org ?? null;
}

/**
 * Tenant-isolation check for the `/[org]/[project]/*` dashboard routes: confirms
 * the logged-in user actually has a membership in the org from the URL, rather
 * than trusting the raw UUID. Callers should `notFound()` on a null result.
 */
export async function getMembershipForUser(userId: string, orgId: string) {
  const [row] = await db
    .select({ org: organizations, membership: memberships })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

export async function getFirstProjectForOrg(orgId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.orgId, orgId)).limit(1);
  return project ?? null;
}

export async function getProjectsForOrg(orgId: string) {
  return db.select().from(projects).where(eq(projects.orgId, orgId)).orderBy(asc(projects.createdAt));
}

/** Confirms `projectId` belongs to `orgId` before it's trusted anywhere downstream. */
export async function getProjectInOrg(orgId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)))
    .limit(1);
  return project ?? null;
}

export async function getEnvironmentsForProject(projectId: string) {
  return db.select().from(environments).where(eq(environments.projectId, projectId)).orderBy(asc(environments.createdAt));
}

/**
 * Resolves which environment a page should render against: the `?env=` query
 * param if it validly belongs to this project, else the project's oldest
 * (first-created) environment. Pages can't read this from the shared layout —
 * layouts don't receive `searchParams` in the App Router — so each
 * environment-scoped page calls this itself.
 */
export async function resolveCurrentEnvironment(projectId: string, requestedEnvId?: string) {
  const envs = await getEnvironmentsForProject(projectId);
  const current = requestedEnvId ? envs.find((e) => e.id === requestedEnvId) : undefined;
  return { environments: envs, current: current ?? envs[0] ?? null };
}

/** Confirms `environmentId` belongs to `projectId` before it's trusted anywhere downstream. */
export async function getEnvironmentInProject(projectId: string, environmentId: string) {
  const [environment] = await db
    .select()
    .from(environments)
    .where(and(eq(environments.id, environmentId), eq(environments.projectId, projectId)))
    .limit(1);
  return environment ?? null;
}

export async function createEnvironment(projectId: string, name: string) {
  const [environment] = await db.insert(environments).values({ projectId, name }).returning();
  return environment;
}

export async function renameEnvironment(environmentId: string, projectId: string, name: string) {
  const [updated] = await db
    .update(environments)
    .set({ name })
    .where(and(eq(environments.id, environmentId), eq(environments.projectId, projectId)))
    .returning();
  return updated ?? null;
}

/**
 * A project always needs somewhere for its API keys to live — deleting the
 * last environment would leave every future key with nowhere to go, so it's
 * refused the same way the last owner of an org can't be removed.
 */
export async function deleteEnvironment(environmentId: string, projectId: string) {
  const remaining = await getEnvironmentsForProject(projectId);
  if (remaining.length <= 1) {
    throw new OrgError("This is the only environment left in the project. Create another one first.");
  }
  if (!remaining.some((e) => e.id === environmentId)) {
    throw new OrgError("That environment does not belong to this project.");
  }

  await db.delete(environments).where(and(eq(environments.id, environmentId), eq(environments.projectId, projectId)));
}

/** Keyed by environment id — how many (non-revoked or not) API keys each environment has, for delete-confirmation copy. */
export async function getApiKeyCountsByEnvironment(projectId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ environmentId: apiKeys.environmentId, total: count() })
    .from(apiKeys)
    .innerJoin(environments, eq(apiKeys.environmentId, environments.id))
    .where(eq(environments.projectId, projectId))
    .groupBy(apiKeys.environmentId);

  return Object.fromEntries(rows.map((r) => [r.environmentId, r.total]));
}

export async function getApiKeysForEnvironment(environmentId: string) {
  return db.select().from(apiKeys).where(eq(apiKeys.environmentId, environmentId)).orderBy(asc(apiKeys.createdAt));
}

export async function createApiKey(
  environmentId: string,
  name: string,
  environmentName: string,
  scopes: ApiKeyScope[] = ["read", "write"]
) {
  const { fullKey, prefix, hash } = generateApiKey(environmentName);
  const [apiKey] = await db
    .insert(apiKeys)
    .values({ environmentId, name, keyPrefix: prefix, keyHash: hash, scopes })
    .returning();
  return { apiKey, fullKey };
}

/** Request counts per API key since `since`, for the API Keys page's per-key usage stat. */
export async function getApiKeyRequestCounts(
  environmentIds: string[],
  since: Date
): Promise<Record<string, number>> {
  if (environmentIds.length === 0) return {};

  const rows = await db
    .select({ apiKeyId: apiRequests.apiKeyId, total: count() })
    .from(apiRequests)
    .where(and(inArray(apiRequests.environmentId, environmentIds), gte(apiRequests.createdAt, since)))
    .groupBy(apiRequests.apiKeyId);

  return Object.fromEntries(rows.filter((r) => r.apiKeyId).map((r) => [r.apiKeyId as string, r.total]));
}

export async function revokeApiKey(apiKeyId: string, environmentId: string) {
  const [updated] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.environmentId, environmentId)))
    .returning();
  return updated ?? null;
}

export async function getOrgById(orgId: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  return org ?? null;
}

export async function renameOrg(orgId: string, name: string) {
  const [updated] = await db.update(organizations).set({ name }).where(eq(organizations.id, orgId)).returning();
  return updated ?? null;
}

/**
 * Onboarding: create org -> project -> "development" environment -> first API key,
 * in one transaction. Returns the full API key (shown once, never persisted in plaintext).
 */
export async function createOrgWithProject(userId: string, orgName: string, projectName: string) {
  return db.transaction(async (tx) => {
    const [org] = await tx.insert(organizations).values({ name: orgName }).returning();
    await tx.insert(memberships).values({ orgId: org.id, userId, role: "owner" });
    const [project] = await tx.insert(projects).values({ orgId: org.id, name: projectName }).returning();
    const [environment] = await tx
      .insert(environments)
      .values({ projectId: project.id, name: "development" })
      .returning();

    const { fullKey, prefix, hash } = generateApiKey(environment.name);
    await tx.insert(apiKeys).values({
      environmentId: environment.id,
      name: "Default key",
      keyPrefix: prefix,
      keyHash: hash,
    });

    return { org, project, environment, apiKey: fullKey };
  });
}

// ---------------------------------------------------------------------------
// Agent-first signup.
//
// `resolveApiKey` (src/lib/with-api-key.ts) authenticates a request by
// joining apiKeys -> environments -> projects -> organizations — it never
// touches users or memberships. That means an org can serve live, fully
// authenticated API traffic with zero members, which is what makes this
// safe to build without touching the `users` table at all: an agent gets a
// working key immediately, and a human claims ownership of the org later
// through the same hashed-token pattern `src/lib/team.ts` uses for invites.
// ---------------------------------------------------------------------------

function hashClaimToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Provisions an org for an agent that hasn't signed anyone up: org -> project
 * -> "development" environment -> first API key -> a claim token, all in one
 * transaction. The API key and the claim token are both shown here once and
 * never recoverable from the database again, same as `createOrgWithProject`.
 */
export async function createAgentOrg() {
  return db.transaction(async (tx) => {
    const [org] = await tx.insert(organizations).values({ name: "Unclaimed agent workspace" }).returning();
    const [project] = await tx.insert(projects).values({ orgId: org.id, name: "Default project" }).returning();
    const [environment] = await tx
      .insert(environments)
      .values({ projectId: project.id, name: "development" })
      .returning();

    const { fullKey, prefix, hash } = generateApiKey(environment.name);
    await tx.insert(apiKeys).values({
      environmentId: environment.id,
      name: "Default key",
      keyPrefix: prefix,
      keyHash: hash,
    });

    const claimToken = randomBytes(32).toString("base64url");
    await tx.insert(orgClaimTokens).values({
      orgId: org.id,
      tokenHash: hashClaimToken(claimToken),
      expiresAt: new Date(Date.now() + AGENT_CLAIM_TTL_DAYS * 24 * 60 * 60 * 1000),
    });

    return { org, project, environment, apiKey: fullKey, claimToken };
  });
}

export type OrgClaimPreview = {
  orgId: string;
  orgName: string;
};

/** Looks a claim token up without consuming it — same GET-safe reasoning as `previewInvitation` in src/lib/team.ts. */
export async function previewOrgClaim(token: string): Promise<OrgClaimPreview | null> {
  const [row] = await db
    .select({ orgId: orgClaimTokens.orgId, orgName: organizations.name, claimedAt: orgClaimTokens.claimedAt, expiresAt: orgClaimTokens.expiresAt })
    .from(orgClaimTokens)
    .innerJoin(organizations, eq(orgClaimTokens.orgId, organizations.id))
    .where(eq(orgClaimTokens.tokenHash, hashClaimToken(token)))
    .limit(1);

  if (!row || row.claimedAt || row.expiresAt.getTime() < Date.now()) return null;
  return { orgId: row.orgId, orgName: row.orgName };
}

/**
 * Turns a claim token into an ownership membership. Single-use, like
 * `acceptInvitation`: the claimed-at stamp and the membership insert happen
 * in one transaction, conditional on the token still being unclaimed, so two
 * simultaneous clicks produce one owner. Unlike a team invite this isn't
 * bound to an email — whoever holds the link becomes this org's owner.
 */
export async function acceptOrgClaim(params: { token: string; userId: string }): Promise<{ orgId: string }> {
  const tokenHash = hashClaimToken(params.token);

  return db.transaction(async (tx) => {
    const [claimRow] = await tx.select().from(orgClaimTokens).where(eq(orgClaimTokens.tokenHash, tokenHash)).limit(1);

    if (!claimRow) throw new OrgError("This claim link is not valid.");
    if (claimRow.claimedAt) throw new OrgError("This workspace has already been claimed.");
    if (claimRow.expiresAt.getTime() < Date.now()) {
      throw new OrgError("This claim link has expired. The workspace's key may no longer work either.");
    }

    const [claimed] = await tx
      .update(orgClaimTokens)
      .set({ claimedAt: new Date(), claimedByUserId: params.userId })
      .where(and(eq(orgClaimTokens.id, claimRow.id), isNull(orgClaimTokens.claimedAt)))
      .returning({ id: orgClaimTokens.id });
    if (!claimed) throw new OrgError("This workspace has already been claimed.");

    await tx.insert(memberships).values({ orgId: claimRow.orgId, userId: params.userId, role: "owner" });

    return { orgId: claimRow.orgId };
  });
}

/**
 * Revokes the API keys of agent-provisioned orgs whose claim window closed
 * with nobody claiming them. `resolveApiKey` never looks at `orgClaimTokens`,
 * so without this an unclaimed key would keep working at full scope and quota
 * forever — the claim token's expiry would be purely cosmetic. Called from
 * the reconcile worker's sweep, alongside the rate-limit and idempotency
 * prunes it already runs for the same "nothing else deletes these" reason.
 */
export async function revokeUnclaimedAgentKeys(now = new Date()): Promise<number> {
  const expired = await db
    .select({ orgId: orgClaimTokens.orgId })
    .from(orgClaimTokens)
    .where(and(isNull(orgClaimTokens.claimedAt), lt(orgClaimTokens.expiresAt, now)));
  if (expired.length === 0) return 0;
  const orgIds = expired.map((row) => row.orgId);

  const keysToRevoke = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .innerJoin(environments, eq(apiKeys.environmentId, environments.id))
    .innerJoin(projects, eq(environments.projectId, projects.id))
    .where(and(inArray(projects.orgId, orgIds), isNull(apiKeys.revokedAt)));
  if (keysToRevoke.length === 0) return 0;

  await db
    .update(apiKeys)
    .set({ revokedAt: now })
    .where(inArray(apiKeys.id, keysToRevoke.map((k) => k.id)));

  return keysToRevoke.length;
}
