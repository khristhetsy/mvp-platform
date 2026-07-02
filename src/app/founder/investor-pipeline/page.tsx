import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InvestorPipelineClient } from "./InvestorPipelineClient";

// pipeline_investors is not yet in generated types — cast to untyped client.
function untyped(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

export const dynamic = "force-dynamic";

export default async function InvestorPipelinePage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);

  // Pre-load investors server-side (safe columns only — no contact_email/phone)
  const supabase = await createServerSupabaseClient();
  const { data: initialInvestors } = await untyped(supabase)
    .from("pipeline_investors")
    .select(
      "id,founder_id,name,location,investor_type,investment_size,pledge_amount,interested,meeting_requested,match_score,outreach_status,source,platform_investor_id,last_contact_date,next_follow_up_date,preferred_stages,focus_sectors,notes,created_at,updated_at"
    )
    .eq("founder_id", profile.id)
    .order("created_at", { ascending: false });

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
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
