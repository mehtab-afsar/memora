import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/lib/session";
import { getCurrentOrgForUser, getFirstProjectForOrg, createOrgWithProject, getEnvironmentsForProject } from "@/lib/org";
import { OnboardingFlow } from "@/features/onboarding/components/onboarding-flow";

export default async function OnboardingPage() {
  const user = await requireUser();

  const existingOrg = await getCurrentOrgForUser(user.id);
  if (existingOrg) {
    const project = await getFirstProjectForOrg(existingOrg.id);
    if (project) redirect(`/${existingOrg.id}/${project.id}/overview`);
  }

  const defaultOrgName = user.name ? `${user.name}'s workspace` : "My workspace";
  const { org, project, apiKey } = await createOrgWithProject(user.id, defaultOrgName, "Default project");
  const [environment] = await getEnvironmentsForProject(project.id);

  return (
    <OnboardingFlow
      userName={user.name}
      orgId={org.id}
      projectId={project.id}
      environmentName={environment?.name ?? "development"}
      apiKey={apiKey}
    />
  );
}
