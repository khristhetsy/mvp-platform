import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { notFound } from "next/navigation";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { FounderKPIGlossary } from "@/components/founder/FounderKPIGlossary";

export const dynamic = "force-dynamic";

export default async function KPIGlossaryPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");

  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "raise_toolkit_guides")) notFound();

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={t("kpi_glossary")}
    >
      <FounderFeatureGate featureKey="dashboard">
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader
            eyebrow={t("financial_literacy")}
            title={t("founder_kpi_glossary")}
            description={t("plain_english_definitions_formulas_benchmarks")}
          />
          <FounderKPIGlossary />
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
