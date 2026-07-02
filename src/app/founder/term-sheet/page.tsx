import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { notFound } from "next/navigation";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TermSheetExplainer } from "@/components/founder/TermSheetExplainer";

export const dynamic = "force-dynamic";

export default async function TermSheetPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");

  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "raise_toolkit_guides")) notFound();

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={t("term_sheet_explainer")}
    >
      <FounderFeatureGate featureKey="dashboard">
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader
            eyebrow={t("capital_education")}
            title={t("term_sheet_explainer")}
            description={t("plain_english_breakdown_of_every_clause_you_ll")}
          />
          <TermSheetExplainer />
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
