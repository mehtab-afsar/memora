import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getMembershipForUser, getFirstProjectForOrg } from "@/lib/org";
import { OrgSettingsForm } from "@/components/dashboard/org-settings-form";
import { BrandMark } from "@/components/brand-mark";

export default async function OrgSettingsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: orgId } = await params;
  const user = await requireUser();

  const membership = await getMembershipForUser(user.id, orgId);
  if (!membership) notFound();

  const project = await getFirstProjectForOrg(orgId);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center gap-4 border-b border-border px-6">
        <div className="flex items-center gap-2">
          <BrandMark className="size-5 text-primary" />
          <span className="text-sm font-semibold tracking-tight text-foreground">MEMORA</span>
        </div>
        {project && (
          <Link
            href={`/${orgId}/${project.id}/overview`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to dashboard
          </Link>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Organization settings</h1>
          <p className="text-sm text-muted-foreground">Single-owner workspace — team invites aren&apos;t available yet.</p>
        </div>
        <OrgSettingsForm orgId={orgId} name={membership.org.name} />
      </div>
    </div>
  );
}
