"use server";

import { assertProjectAccess } from "@/lib/dashboard-auth";
import { getEnvironmentInProject } from "@/lib/org";
import { recall, remember, type RecallResult, type RememberOutcome } from "@/lib/memory-engine";
import { drainPendingJobs } from "@/lib/reconcile";
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

/**
 * The write half of the playground.
 *
 * Without it a new project is unusable from the dashboard: you land on a
 * recall box, have nothing stored to recall, and the only way to put a memory
 * in is curl. That is a dead first run.
 *
 * Unlike the API, this drains the reconciliation queue before returning. In
 * production that judgement happens after the response because no caller
 * should wait for it — but here the whole point is to *watch* it happen, and
 * a playground that shows you "pending" and nothing else teaches nothing.
 */
export async function runRememberAction(
  orgId: string,
  projectId: string,
  environmentId: string,
  input: { endUserId: string; content: string }
): Promise<RememberOutcome[]> {
  const { project } = await assertProjectAccess(orgId, projectId);

  const environment = await getEnvironmentInProject(project.id, environmentId);
  if (!environment) throw new Error("Environment not found");

  const scope = { projectId: project.id, environmentId: environment.id, endUserId: input.endUserId };

  return withUsageTracking({ projectId: project.id, environmentId: environment.id, source: "dashboard" }, async () => {
    const { outcomes } = await remember({ ...scope, content: input.content, sourceType: "playground" });

    for (let pass = 0; pass < 20; pass++) {
      if ((await drainPendingJobs(scope, 25)) === 0) break;
    }

    return outcomes;
  });
}
