import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/lib/session";
import { getCurrentOrgForUser, getFirstProjectForOrg, createOrgWithProject, getEnvironmentsForProject } from "@/lib/org";
import { OnboardingFlow } from "@/features/onboarding/components/onboarding-flow";
import { seedDemoUser } from "@/lib/demo-data";

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

  // A memory product with no memories is an empty box: every query answers
  // "nothing matched", which is correct and useless as a first impression. The
  // new project starts with one end-user who already has a history, so the
  // Playground demonstrates something on the first try instead of after three
  // weeks of accumulated data.
  if (environment) {
    try {
      await seedDemoUser({ projectId: project.id, environmentId: environment.id });
    } catch {
      // Never block a signup on this. An empty project is worse than a seeded
      // one, and much better than an account that could not be created because
      // a third party was rate-limiting us.
    }
  }

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
