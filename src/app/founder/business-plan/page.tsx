import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { BusinessPlanGeneratorClient } from "@/components/founder/BusinessPlanGeneratorClient";
import { BusinessPlanCharts } from "@/components/founder/BusinessPlanCharts";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business plan" };

export default async function FounderBusinessPlanPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");

  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "business_plan")) notFound();

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={t("business_plan")}
    >
      <FounderJourneyGate minStage="qualify">
        <PageHeader
          eyebrow={t("raise_toolkit")}
          title={t("ai_business_plan")}
          description={t("build_an_investor_ready_plan_in_minutes_most_o")}
        />
        <BusinessPlanGeneratorClient />
        <BusinessPlanCharts />
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
