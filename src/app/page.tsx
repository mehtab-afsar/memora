import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentOrgForUser, getFirstProjectForOrg } from "@/lib/org";
import { LandingPage } from "@/components/marketing/landing-page";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) {
    return <LandingPage />;
  }

  const org = await getCurrentOrgForUser(session.user.id);
  if (!org) {
    redirect("/onboarding");
  }

  const project = await getFirstProjectForOrg(org.id);
  if (!project) {
    redirect("/onboarding");
  }

  redirect(`/${org.id}/${project.id}/overview`);
}
