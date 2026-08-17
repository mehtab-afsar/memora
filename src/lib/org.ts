import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, memberships, projects, environments, apiKeys } from "@/db/schema";
import { generateApiKey } from "@/lib/api-keys";

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

export async function getApiKeysForEnvironment(environmentId: string) {
  return db.select().from(apiKeys).where(eq(apiKeys.environmentId, environmentId)).orderBy(asc(apiKeys.createdAt));
}

export async function createApiKey(environmentId: string, name: string, environmentName: string) {
  const { fullKey, prefix, hash } = generateApiKey(environmentName);
  const [apiKey] = await db
    .insert(apiKeys)
    .values({ environmentId, name, keyPrefix: prefix, keyHash: hash })
    .returning();
  return { apiKey, fullKey };
}

export async function revokeApiKey(apiKeyId: string, environmentId: string) {
  const [updated] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.environmentId, environmentId)))
    .returning();
  return updated ?? null;
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
