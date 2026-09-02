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
import { loadPartnerScoresBatch } from "@/lib/investor-rating/snapshot";
import { getRatingConfig } from "@/lib/investor-rating/weights";
import { tierFromScore } from "@/lib/investor-rating/scoring";
import { TIER_LABELS } from "@/lib/investor-rating/types";
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
  // A Deal Company (null active company) has no founder pipeline — deep-links 404
  // rather than surfacing a founder-account investor.
  if (!company) notFound();
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

  // Investor rating = the member's Partner Score (via platform_investor_id) plus the
  // SEC Form D verified bonus when the linked prospect came from Form D. Null → "New".
  let investorScore: number | null = null;
  let investorScoreTier: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = admin as any;
    const { secFormDBonus, odooBonus } = await getRatingConfig(a);
    let base: number | null = null;
    if (link?.platform_investor_id) {
      base = (await loadPartnerScoresBatch(a, [link.platform_investor_id])).get(link.platform_investor_id)?.score ?? null;
    }
    let isFormD = false;
    let isOdoo = false;
    if (link?.name) {
      const { data: pi } = await a
        .from("prospect_investors")
        .select("source, source_ref")
        .ilike("name", `${String(link.name).trim()}%`)
        .limit(1)
        .maybeSingle();
      isFormD = (pi?.source ?? "") === "SEC Form D";
      // Odoo-origin: imported as source='investor_crm' with source_ref = the
      // crm_contacts id; confirm that contact is actually Odoo-sourced.
      if (!isFormD && (pi?.source ?? "") === "investor_crm" && pi?.source_ref) {
        const { data: cc } = await a.from("crm_contacts").select("id").eq("id", pi.source_ref).eq("source", "odoo").maybeSingle();
        isOdoo = !!cc;
      }
    }
    const bonus = isFormD ? secFormDBonus : isOdoo ? odooBonus : 0;
    if (base != null || bonus > 0) {
      investorScore = Math.min(100, (base ?? 0) + bonus);
      investorScoreTier = TIER_LABELS[tierFromScore(investorScore)];
    }
  } catch { /* rating unavailable → New */ }

  const detail: PipelineInvestorDetail = {
    ...(data as PipelineInvestorDetail),
    investor_score: investorScore,
    investor_score_tier: investorScoreTier,
  };

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="investor_access">
        <WorkspacePageContainer>
          <InvestorDetailClient investor={detail} preferences={preferences} />
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
