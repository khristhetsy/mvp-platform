import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { DealCompanyEmptyState } from "@/components/founder/DealCompanyEmptyState";
import { MarketClaimClient } from "@/components/founder/MarketClaimClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Market claim grader" };

export default async function MarketClaimPage() {
  const profile = await requireRole(["founder"]);
  const { company } = await getActiveCompanyForUser(profile);

  if (!company) {
    return (
      <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle="No active raise">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow="Stage 2 · Preparation"
            title="Market claim grader"
            description="Grade your market narrative the way the investor network reads it — then see the objections reviewers raise and what clears them."
          />
          <DealCompanyEmptyState />
        </WorkspacePageContainer>
      </FounderAppShell>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: deck } = await supabase
    .from("documents")
    .select("id, file_name, created_at")
    .eq("company_id", company.id)
    .eq("document_type", "PITCH_DECK")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={company.company_name ?? "Your company"}>
      <FounderFeatureGate featureKey="ai_diligence">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow="Stage 2 · Preparation"
            title="Market claim grader"
            description="Grade your market narrative the way the investor network reads it — then see the objections reviewers raise and what clears them."
          />
          <MarketClaimClient
            companyName={company.company_name ?? "Your company"}
            industry={company.industry ?? null}
            stage={company.revenue_stage ?? null}
            hasDeck={Boolean(deck)}
            deckFileName={deck?.file_name ?? null}
          />
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
