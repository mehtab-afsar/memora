"use server";

import { revalidatePath } from "next/cache";
import { assertProjectAccess } from "@/lib/dashboard-auth";
import { getEnvironmentInProject } from "@/lib/org";
import {
  recordExperience,
  recallExperiences,
  recommendForTask,
  type RecordExperienceInput,
  type ExperienceRecallResult,
  type RecommendationResult,
} from "@/lib/experience-engine";

async function resolveEnvironmentScope(orgId: string, projectId: string, environmentId: string) {
  const { project } = await assertProjectAccess(orgId, projectId);
  const environment = await getEnvironmentInProject(project.id, environmentId);
  if (!environment) throw new Error("Environment not found");
  return { projectId: project.id, environmentId: environment.id };
}

export async function recordExperienceAction(
  orgId: string,
  projectId: string,
  environmentId: string,
  input: Omit<RecordExperienceInput, "sourceType" | "sourceId">
) {
  const scope = await resolveEnvironmentScope(orgId, projectId, environmentId);
  const experience = await recordExperience(scope, { ...input, sourceType: "dashboard" });
  revalidatePath(`/${orgId}/${projectId}/experiences`);
  return experience;
}

export async function runExperienceRecallAction(
  orgId: string,
  projectId: string,
  environmentId: string,
  query: string,
  topK: number
): Promise<ExperienceRecallResult[]> {
  const scope = await resolveEnvironmentScope(orgId, projectId, environmentId);
  return recallExperiences(scope, query, topK);
}

export async function getRecommendationAction(
  orgId: string,
  projectId: string,
  environmentId: string,
  task: string
): Promise<RecommendationResult> {
  const scope = await resolveEnvironmentScope(orgId, projectId, environmentId);
  return recommendForTask(scope, task);
}
