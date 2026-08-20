import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentOrgForUser, getFirstProjectForOrg } from "@/lib/org";
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
    redirect("/onboarding");
  }

  const project = await getFirstProjectForOrg(org.id);
  if (!project) {
    redirect("/onboarding");
  }

  redirect(`/${org.id}/${project.id}/overview`);
}
