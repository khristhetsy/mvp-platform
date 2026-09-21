import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { CapTableClient } from "@/components/founder/CapTableClient";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { DealCompanyEmptyState } from "@/components/founder/DealCompanyEmptyState";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveActingFounderScope } from "@/lib/admin/act-on-behalf";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cap table" };

export default async function FounderCapTablePage() {
  // Act-on-behalf: permissioned staff render as the founder; otherwise normal gate.
  const acting = await resolveActingFounderScope();
  const profile = acting ? acting.profile : await requireRole(["founder"]);
  const t = await getTranslations("appPages");

  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "cap_table")) notFound();

  const company = acting ? acting.company : (await getActiveCompanyForUser(profile)).company;
  if (!company) {
    return (
      <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle="No active raise">
        <PageHeader eyebrow={t("raise_toolkit")} title={t("cap_table")} description={t("lay_out_who_owns_what_model_a_round_to_see_dil")} />
        <DealCompanyEmptyState />
      </FounderAppShell>
    );
  }

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={t("cap_table")}
    >
      <FounderJourneyGate minStage="qualify">
        <PageHeader
          eyebrow={t("raise_toolkit")}
          title={t("cap_table")}
          description={t("lay_out_who_owns_what_model_a_round_to_see_dil")}
        />
        <CapTableClient />
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
