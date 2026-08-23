import Link from "next/link";
import { Building2, CreditCard, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { OrgSettingsForm } from "@/features/organization/components/org-settings-form";
import { DangerZone } from "@/features/organization/components/danger-zone";
import type { Role } from "@/lib/team";

export function OrganizationSettingsPage({
  orgId,
  orgName,
  createdAt,
  memberCount,
  planLabel,
  currentRole,
}: {
  orgId: string;
  orgName: string;
  createdAt: Date;
  memberCount: number;
  planLabel: string;
  currentRole: Role;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Building2}
        title="Organization"
        description={`Created ${createdAt.toLocaleDateString()}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href={`/${orgId}/settings/team`}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted/40"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Users className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </p>
            <p className="text-xs text-muted-foreground">Manage the team →</p>
          </div>
        </Link>

        <Link
          href={`/${orgId}/settings/billing`}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted/40"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <CreditCard className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{planLabel} plan</p>
            <p className="text-xs text-muted-foreground">Manage billing →</p>
          </div>
        </Link>
      </div>

      <OrgSettingsForm orgId={orgId} name={orgName} />

      {currentRole === "owner" && <DangerZone orgId={orgId} orgName={orgName} />}
    </div>
  );
}
