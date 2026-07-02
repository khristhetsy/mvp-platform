import { notFound } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { getTranslations } from "next-intl/server";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { RegCfGeneratorClient } from "@/components/founder/RegCfGeneratorClient";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderRegCfPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");

  // Off by default — only reachable once an admin enables founder:regcf.
  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "regcf")) notFound();

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={t("reg_cf_materials")}
    >
      <FounderJourneyGate minStage="deploy">
        <PageHeader
          eyebrow={t("raise_toolkit")}
          title={t("reg_cf_materials_generator")}
          description={t("ai_draft_your_regulation_crowdfunding_document")}
        />
        <RegCfGeneratorClient />
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
