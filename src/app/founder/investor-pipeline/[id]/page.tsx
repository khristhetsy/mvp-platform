import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { requireRole } from "@/lib/supabase/auth";
import { loadInvestorPreferences } from "@/lib/investors/contact-preferences";
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
  const { company } = await getActiveCompanyForUser(profile);
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

  // Investor preferences from the CRM contact — resolve an email to look up by
  // (never displayed): stored contact email → member profile → prospect record.
  const admin = createServiceRoleClient();
  const { data: link } = await untyped(admin)
    .from("pipeline_investors")
    .select("contact_email, platform_investor_id, name")
    .eq("id", id)
    .eq("founder_id", profile.id)
    .maybeSingle();
  let email: string | null = (link?.contact_email as string | null) ?? null;
  if (!email && link?.platform_investor_id) {
    const { data: p } = await untyped(admin).from("profiles").select("email").eq("id", link.platform_investor_id).maybeSingle();
    email = (p?.email as string | null) ?? null;
  }
  if (!email && link?.name) {
    const { data: pi } = await untyped(admin)
      .from("prospect_investors")
      .select("email")
      .ilike("name", `${String(link.name).trim()}%`)
      .limit(1)
      .maybeSingle();
    email = (pi?.email as string | null) ?? null;
  }
  const preferences = await loadInvestorPreferences(admin, email).catch(() => []);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="investor_access">
        <WorkspacePageContainer>
          <InvestorDetailClient investor={data as PipelineInvestorDetail} preferences={preferences} />
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
