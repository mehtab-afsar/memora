import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getCurrentOrgForUser, getFirstProjectForOrg, createOrgWithProject } from "@/lib/org";
import { BrandMark } from "@/components/brand-mark";
import { OnboardingSuccess } from "@/components/onboarding-success";

export default async function OnboardingPage() {
  const user = await requireUser();

  const existingOrg = await getCurrentOrgForUser(user.id);
  if (existingOrg) {
    const project = await getFirstProjectForOrg(existingOrg.id);
    if (project) redirect(`/${existingOrg.id}/${project.id}/overview`);
  }

  const defaultOrgName = user.name ? `${user.name}'s workspace` : "My workspace";
  const { org, project, apiKey } = await createOrgWithProject(user.id, defaultOrgName, "Default project");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center px-6">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark className="size-5 text-primary" />
          <span className="text-sm font-semibold tracking-tight text-foreground">MEMORA</span>
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-6 pb-24">
        <OnboardingSuccess orgId={org.id} projectId={project.id} apiKey={apiKey} />
      </main>
    </div>
  );
}
