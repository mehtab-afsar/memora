"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertProjectAccess } from "@/features/auth/lib/dashboard-auth";
import { getMemoryInProject } from "@/lib/memory-engine";
import { verify, forgetMemory, updateMemory } from "@/lib/memory-engine";
import { withUsageTracking } from "@/lib/usage-tracking";

async function resolveMemoryScope(orgId: string, projectId: string, memoryId: string) {
  const { project } = await assertProjectAccess(orgId, projectId);
  const memory = await getMemoryInProject(memoryId, project.id);
  if (!memory) throw new Error("Memory not found");
  return { projectId: memory.projectId, environmentId: memory.environmentId };
}

export async function verifyMemoryAction(orgId: string, projectId: string, memoryId: string) {
  const scope = await resolveMemoryScope(orgId, projectId, memoryId);
  const result = await withUsageTracking({ ...scope, source: "dashboard" }, () => verify(memoryId, scope));
  revalidatePath(`/${orgId}/${projectId}/memories/${memoryId}`);
  return result;
}

export async function updateMemoryAction(
  orgId: string,
  projectId: string,
  memoryId: string,
  patch: { content?: string; confidence?: number; importance?: number }
) {
  const scope = await resolveMemoryScope(orgId, projectId, memoryId);
  await withUsageTracking({ ...scope, source: "dashboard" }, () => updateMemory(memoryId, scope, patch));
  revalidatePath(`/${orgId}/${projectId}/memories/${memoryId}`);
}

export async function forgetMemoryAction(orgId: string, projectId: string, memoryId: string) {
  const scope = await resolveMemoryScope(orgId, projectId, memoryId);
  await forgetMemory(memoryId, scope);
  revalidatePath(`/${orgId}/${projectId}/memories`);
  redirect(`/${orgId}/${projectId}/memories`);
}
