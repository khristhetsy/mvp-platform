import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { FinancialModelClient } from "@/components/founder/FinancialModelClient";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { resolveActingFounderScope } from "@/lib/admin/act-on-behalf";
import { ActingAsBanner } from "@/components/admin/ActingAsBanner";
import { DealCompanyEmptyState } from "@/components/founder/DealCompanyEmptyState";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Financial model" };

export default async function FounderFinancialModelPage() {
  // Act-on-behalf: permissioned staff render as the founder; otherwise normal gate.
  const acting = await resolveActingFounderScope();
  const profile = acting ? acting.profile : await requireRole(["founder"]);
  const t = await getTranslations("appPages");

  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "financial_model")) notFound();

  const company = acting ? acting.company : (await getActiveCompanyForUser(profile)).company;
  if (!company) {
    return (
      <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle="No active raise">
        <PageHeader eyebrow={t("raise_toolkit")} title={t("financial_model")} description={t("a_driver_based_3_year_model_investors_can_open")} />
        <DealCompanyEmptyState />
      </FounderAppShell>
    );
  }

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={t("financial_model")}
    >
      <ActingAsBanner />
      {acting ? (
        <>
          <PageHeader
            eyebrow={t("raise_toolkit")}
            title={t("financial_model")}
            description={t("a_driver_based_3_year_model_investors_can_open")}
          />
          <FinancialModelClient />
        </>
      ) : (
        <FounderJourneyGate minStage="qualify">
          <PageHeader
            eyebrow={t("raise_toolkit")}
            title={t("financial_model")}
            description={t("a_driver_based_3_year_model_investors_can_open")}
          />
          <FinancialModelClient />
        </FounderJourneyGate>
      )}
    </FounderAppShell>
  );
}
