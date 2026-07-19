import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { InvestorOutreachManager } from "@/components/admin/matching/InvestorOutreachManager";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminInvestorOutreachPage() {
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
          eyebrow="Matching"
          title="Investor outreach approvals"
          description="AI-drafted introductions to strong-fit investors. Every campaign requires admin approval before it can queue, is capped per week, and live email sending stays disabled until the flag is enabled and the copy is counsel-approved."
        />

        <InvestorOutreachManager />
      </WorkspacePageContainer>
    </AppShell>
  );
}
