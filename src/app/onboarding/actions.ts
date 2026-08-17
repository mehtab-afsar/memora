"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { createOrgWithProject, getCurrentOrgForUser } from "@/lib/org";

const onboardingSchema = z.object({
  orgName: z.string().trim().min(1).max(200),
  projectName: z.string().trim().min(1).max(200),
});

export type OnboardingState = {
  error?: string;
  result?: {
    orgId: string;
    orgName: string;
    projectId: string;
    projectName: string;
    environmentId: string;
    environmentName: string;
    apiKey: string;
  };
};

export async function onboardingAction(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not signed in" };
  }

  const existingOrg = await getCurrentOrgForUser(session.user.id);
  if (existingOrg) {
    return { error: "You already have an organization set up" };
  }

  const parsed = onboardingSchema.safeParse({
    orgName: formData.get("orgName"),
    projectName: formData.get("projectName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { org, project, environment, apiKey } = await createOrgWithProject(
    session.user.id,
    parsed.data.orgName,
    parsed.data.projectName
  );

  return {
    result: {
      orgId: org.id,
      orgName: org.name,
      projectId: project.id,
      projectName: project.name,
      environmentId: environment.id,
      environmentName: environment.name,
      apiKey,
    },
  };
}
