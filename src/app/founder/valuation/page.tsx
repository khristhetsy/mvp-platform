import { notFound } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import { listValuations } from "@/lib/valuation/store";
import { ValuationStudioClient, type ValuationProfile } from "@/components/founder/ValuationStudioClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Valuation Studio" };

/** Map the company's revenue stage to a valuation stage profile (spec §3). */
function toStageProfile(revenueStage: string | null | undefined): "preseed" | "seed" | "revenue" {
  const s = String(revenueStage ?? "").toLowerCase();
  if (s.includes("pre") || s.includes("idea") || s.includes("preseed")) return "preseed";
  if (s.includes("growth") || s.includes("scal") || s.includes("series_b") || s.includes("later")) return "revenue";
  return "seed";
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 9999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default async function FounderValuationPage() {
  const profile = await requireRole(["founder"]);
  const supabase = await createServerSupabaseClient();

  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "valuation")) notFound();

  // Plan gate — Basic + Professional (not trial). Route enforces this too.
  const plan = await getUserPlan(profile.id);
  const planEligible = plan === "founder_basic" || plan === "founder_professional";

  const { company, org } = await getActiveCompanyForUser(profile);
  const saved = planEligible && org ? await listValuations(supabase, org.id) : [];

  // Build the profile-intake object. A Deal Company (null company) has no profile
  // to load — the client falls back to the blank path (spec §6.2).
  let valuationProfile: ValuationProfile | null = null;
  if (company) {
    const c = company as unknown as {
      company_name?: string | null;
      industry?: string | null;
      revenue_stage?: string | null;
      funding_amount?: number | string | null;
      updated_at?: string | null;
    };
    const stale = daysSince(c.updated_at);
    valuationProfile = {
      company: c.company_name ?? "Your company",
      sector: c.industry ?? "B2B SaaS",
      stage: toStageProfile(c.revenue_stage),
      staleDays: stale,
      updatedLabel: stale <= 1 ? "today" : `${stale} days ago`,
      fields: {
        raiseAmount: c.funding_amount != null ? Number(c.funding_amount) : undefined,
      },
      // Not collected at onboarding — named up front so the founder isn't surprised.
      missing: ["arr", "growthRate", "ownershipLow", "ownershipHigh", "exitRevenue", "exitMultiple", "compLow", "compHigh"],
    };
  }

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle="Valuation Studio"
    >
      <FounderJourneyGate minStage="qualify">
        <PageHeader
          eyebrow="Raise toolkit"
          title="Valuation Studio"
          description="An indicative valuation range to prepare with, not a price. Runs the same methods used by investment bankers, venture funds, and angel investors, then shows where they disagree."
        />
        {planEligible ? (
          <ValuationStudioClient profile={valuationProfile} saved={saved} />
        ) : (
          <div className="rounded-2xl border border-[#E3E8F2] bg-white p-8 text-center">
            <p className="text-sm text-[#5A6782]">
              The Valuation Studio is available on the Basic and Professional plans.{" "}
              <a href="/founder/settings/billing" className="font-medium text-indigo-700">Upgrade to unlock it.</a>
            </p>
          </div>
        )}
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
