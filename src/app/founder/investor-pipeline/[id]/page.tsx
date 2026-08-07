import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";
import { InvestorDetailClient, type PipelineInvestorDetail } from "./InvestorDetailClient";

function untyped(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

export const dynamic = "force-dynamic";

export default async function InvestorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRole(["founder"]);
  const { id } = await params;
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();

  // Safe columns only — never contact_email / contact_phone.
  const { data } = await untyped(supabase)
    .from("pipeline_investors")
    .select(
      "id,name,location,investor_type,investment_size,pledge_amount,match_score,pipeline_stage,meeting_requested,source,platform_investor_id,preferred_stages,focus_sectors,notes",
    )
    .eq("id", id)
    .eq("founder_id", profile.id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="investor_access">
        <WorkspacePageContainer>
          <InvestorDetailClient investor={data as PipelineInvestorDetail} />
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
