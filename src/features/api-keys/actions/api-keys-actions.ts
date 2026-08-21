"use server";

import { revalidatePath } from "next/cache";
import { assertProjectAccess } from "@/lib/dashboard-auth";
import { getEnvironmentInProject, createApiKey, revokeApiKey } from "@/lib/org";

export async function createApiKeyAction(
  orgId: string,
  projectId: string,
  environmentId: string,
  name: string
): Promise<string> {
  const { project } = await assertProjectAccess(orgId, projectId);

  const environment = await getEnvironmentInProject(project.id, environmentId);
  if (!environment) throw new Error("Environment not found");

  const { fullKey } = await createApiKey(environment.id, name || "Untitled key", environment.name);
  revalidatePath(`/${orgId}/${projectId}/settings/api-keys`);
  return fullKey;
}

export async function revokeApiKeyAction(
  orgId: string,
  projectId: string,
  environmentId: string,
  apiKeyId: string
) {
  const { project } = await assertProjectAccess(orgId, projectId);

  const environment = await getEnvironmentInProject(project.id, environmentId);
  if (!environment) throw new Error("Environment not found");

  await revokeApiKey(apiKeyId, environment.id);
  revalidatePath(`/${orgId}/${projectId}/settings/api-keys`);
}
