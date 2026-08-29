import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DealCompanyEmptyState } from "@/components/founder/DealCompanyEmptyState";
import { InvestorPipelineClient } from "./InvestorPipelineClient";
import { ManualInvestorsPanel } from "@/components/founder/ManualInvestorsPanel";
import { listManualInvestors } from "@/lib/founder/manual-investors";

// pipeline_investors is not yet in generated types — cast to untyped client.
function untyped(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

export const dynamic = "force-dynamic";

export default async function InvestorPipelinePage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const { company, org } = await getActiveCompanyForUser(profile);

  if (!company) {
    return (
      <FounderAppShell
        profileName={profile.full_name ?? profile.email ?? "Founder"}
        profileSubtitle="No active raise"
      >
        <PageHeader
          eyebrow={t("investor_pipeline")}
          title={t("investor_pipeline")}
          description={t("track_and_manage_your_investor_relationships_p")}
        />
        <DealCompanyEmptyState />
      </FounderAppShell>
    );
  }

  // Pre-load investors server-side (safe columns only — no contact_email/phone).
  // Scope to the ACTIVE account: filter by org_id when the org model applies, so
  // a Deal Company shows no pipeline; fall back to founder_id pre-backfill. RLS
  // still restricts to the user's own rows either way.
  const supabase = await createServerSupabaseClient();
  const pipelineQuery = untyped(supabase)
    .from("pipeline_investors")
    .select(
      "id,founder_id,name,location,investor_type,investment_size,pledge_amount,interested,meeting_requested,match_score,outreach_status,pipeline_stage,source,platform_investor_id,last_contact_date,next_follow_up_date,preferred_stages,focus_sectors,notes,created_at,updated_at"
    )
    .order("created_at", { ascending: false });
  const { data: initialInvestors } = await (org
    ? pipelineQuery.eq("org_id", org.id)
    : pipelineQuery.eq("founder_id", profile.id));

  const manualInvestors = await listManualInvestors(supabase, company.id);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="investor_access">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow={t("investor_pipeline")}
            title={t("investor_pipeline")}
            description={t("track_and_manage_your_investor_relationships_p")}
          />
          <InvestorPipelineClient initialData={initialInvestors ?? []} />
          <ManualInvestorsPanel investors={manualInvestors} />
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
