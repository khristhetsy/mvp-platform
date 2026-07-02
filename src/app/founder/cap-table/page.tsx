import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { CapTableClient } from "@/components/founder/CapTableClient";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cap table" };

export default async function FounderCapTablePage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");

  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "cap_table")) notFound();

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
