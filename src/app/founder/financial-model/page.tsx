import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { FinancialModelClient } from "@/components/founder/FinancialModelClient";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Financial model" };

export default async function FounderFinancialModelPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");

  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "financial_model")) notFound();

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={t("financial_model")}
    >
      <FounderJourneyGate minStage="qualify">
        <PageHeader
          eyebrow={t("raise_toolkit")}
          title={t("financial_model")}
          description={t("a_driver_based_3_year_model_investors_can_open")}
        />
        <FinancialModelClient />
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
