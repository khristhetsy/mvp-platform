import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { MatchQualificationControls } from "@/components/admin/MatchQualificationControls";
import { InvestorOutreachManager } from "@/components/admin/matching/InvestorOutreachManager";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function OutreachQualificationPage() {
  const profile = await requireRole(["admin", "analyst"]);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Investor Relations"
          title="Outreach Qualification"
          description="Match rules, send automation, the investor message, and active outreach campaigns — all in one place."
        />

        <div className="space-y-6">
          <MatchQualificationControls />
          <InvestorOutreachManager />
        </div>
      </WorkspacePageContainer>
    </AppShell>
  );
}
