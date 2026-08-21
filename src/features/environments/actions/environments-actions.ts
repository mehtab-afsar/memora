"use server";

import { revalidatePath } from "next/cache";
import { assertProjectAccess } from "@/features/auth/lib/dashboard-auth";
import { createEnvironment } from "@/lib/org";

export async function createEnvironmentAction(orgId: string, projectId: string, name: string) {
  const { project } = await assertProjectAccess(orgId, projectId);
  await createEnvironment(project.id, name);
  revalidatePath(`/${orgId}/${projectId}/settings/environments`);
}
