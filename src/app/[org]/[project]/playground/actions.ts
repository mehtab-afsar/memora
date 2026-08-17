"use server";

import { assertProjectAccess } from "@/lib/dashboard-auth";
import { getEnvironmentInProject } from "@/lib/org";
import { recall, type RecallResult } from "@/lib/memory-engine";
import { withUsageTracking } from "@/lib/usage-tracking";

export async function runRecallAction(
  orgId: string,
  projectId: string,
  environmentId: string,
  input: { endUserId: string; query: string; topK: number }
): Promise<RecallResult[]> {
  const { project } = await assertProjectAccess(orgId, projectId);

  const environment = await getEnvironmentInProject(project.id, environmentId);
  if (!environment) throw new Error("Environment not found");

  return withUsageTracking(
    { projectId: project.id, environmentId: environment.id, source: "dashboard" },
    () =>
      recall({
        projectId: project.id,
        environmentId: environment.id,
        endUserId: input.endUserId,
        query: input.query,
        topK: input.topK,
      })
  );
}
