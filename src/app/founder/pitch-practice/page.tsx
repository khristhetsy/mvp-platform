import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { notFound } from "next/navigation";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PitchPracticeSimulator } from "@/components/founder/PitchPracticeSimulator";

export const dynamic = "force-dynamic";

export default async function PitchPracticePage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");

  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "raise_toolkit_guides")) notFound();

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={t("pitch_practice")}
    >
      <FounderFeatureGate featureKey="dashboard">
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader
            eyebrow={t("fundraising_prep")}
            title={t("pitch_practice_simulator")}
            description={t("answer_real_investor_questions_using_proven_fr")}
          />
          <PitchPracticeSimulator />
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
