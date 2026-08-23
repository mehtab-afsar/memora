import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/features/auth/lib/session";
import { getCurrentOrgForUser, getFirstProjectForOrg } from "@/lib/org";
import { LandingPage } from "@/features/landing/components/landing-page";

export const metadata: Metadata = {
  title: "MEMORA — The trust layer for AI memory",
  description:
    "MEMORA decides what's worth remembering, resolves contradictions instead of guessing, and explains why every memory exists — so your AI agents get more reliable over time, not noisier.",
};

export default async function Home() {
  // `currentUser` rather than the raw session: a JWT cookie outlives the user
  // row it names, and treating a stale one as signed in bounced visitors
  // through /onboarding to /login — making the public landing page
  // unreachable for anyone who had ever logged in.
  const user = await currentUser();
  if (!user) {
    return <LandingPage />;
  }

  const org = await getCurrentOrgForUser(user.id);
  if (!org) {
    redirect("/onboarding");
  }

  const project = await getFirstProjectForOrg(org.id);
  if (!project) {
    // org+project are always created together — this would mean the data is
    // inconsistent, not that onboarding needs to run again.
    notFound();
  }

  redirect(`/${org.id}/${project.id}/overview`);
}
