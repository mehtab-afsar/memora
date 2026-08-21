import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentOrgForUser, getFirstProjectForOrg, createOrgWithProject } from "@/lib/org";
import { LandingPage } from "@/components/marketing/landing-page";

export const metadata: Metadata = {
  title: "MEMORA — The trust layer for AI memory",
  description:
    "MEMORA decides what's worth remembering, resolves contradictions instead of guessing, and explains why every memory exists — so your AI agents get more reliable over time, not noisier.",
};

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) {
    return <LandingPage />;
  }

  const org = await getCurrentOrgForUser(session.user.id);
  if (!org) {
    // No dedicated onboarding step — a first workspace is provisioned silently
    // and the user lands straight in it. A real onboarding flow comes later;
    // for now the only thing worth showing is the product itself.
    const defaultOrgName = session.user.name ? `${session.user.name}'s workspace` : "My workspace";
    const created = await createOrgWithProject(session.user.id, defaultOrgName, "Default project");
    redirect(`/${created.org.id}/${created.project.id}/overview`);
  }

  const project = await getFirstProjectForOrg(org.id);
  if (!project) {
    // org+project are always created together — this would mean the data is
    // inconsistent, not that onboarding needs to run again.
    notFound();
  }

  redirect(`/${org.id}/${project.id}/overview`);
}
