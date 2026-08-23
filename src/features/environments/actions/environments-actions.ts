"use server";

import { revalidatePath } from "next/cache";
import { assertProjectAccess } from "@/features/auth/lib/dashboard-auth";
import { createEnvironment, renameEnvironment, deleteEnvironment, OrgError } from "@/lib/org";

export type EnvironmentActionResult = { error?: string };

export async function createEnvironmentAction(orgId: string, projectId: string, name: string) {
  const { project } = await assertProjectAccess(orgId, projectId);
  await createEnvironment(project.id, name);
  revalidatePath(`/${orgId}/${projectId}/settings/environments`);
}

export async function renameEnvironmentAction(
  orgId: string,
  projectId: string,
  environmentId: string,
  name: string
): Promise<EnvironmentActionResult> {
  const { project } = await assertProjectAccess(orgId, projectId);
  await renameEnvironment(environmentId, project.id, name);
  revalidatePath(`/${orgId}/${projectId}/settings/environments`);
  return {};
}

export async function deleteEnvironmentAction(
  orgId: string,
  projectId: string,
  environmentId: string
): Promise<EnvironmentActionResult> {
  const { project } = await assertProjectAccess(orgId, projectId);
  try {
    await deleteEnvironment(environmentId, project.id);
  } catch (error) {
    if (error instanceof OrgError) return { error: error.message };
    console.error("[environments]", error);
    return { error: "Something went wrong. Please try again." };
  }
  revalidatePath(`/${orgId}/${projectId}/settings/environments`);
  return {};
}
