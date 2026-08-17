import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentOrgForUser, getFirstProjectForOrg } from "@/lib/org";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
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
