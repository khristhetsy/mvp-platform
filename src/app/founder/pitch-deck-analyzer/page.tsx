import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getPitchDeckAnalysis } from "@/lib/pitch-deck/analysis-store";
import { PitchDeckAnalyzerClient } from "@/components/founder/PitchDeckAnalyzerClient";
import { DealCompanyEmptyState } from "@/components/founder/DealCompanyEmptyState";

export const dynamic = "force-dynamic";

export default async function PitchDeckAnalyzerPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const { company } = await getActiveCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();

  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "pitch_deck_analyzer")) notFound();

  // Deal Company (no active company) has no deck to analyze — show a single empty state.
  if (!company) {
    return (
      <FounderAppShell
        profileName={profile.full_name ?? profile.email ?? "Founder"}
        profileSubtitle="No active raise"
      >
        <WorkspacePageContainer>
          <PageHeader
            eyebrow={t("raise_toolkit_2")}
            title={t("pitch_deck_ai_analyzer")}
            description={t("get_scored_slide_by_slide_ai_feedback_on_your")}
          />
          <DealCompanyEmptyState />
        </WorkspacePageContainer>
      </FounderAppShell>
    );
  }

  // Check if a pitch deck is already uploaded
  const { data: pitchDeck } = company
    ? await supabase
        .from("documents")
        .select("id, file_name, created_at")
        .eq("company_id", company.id)
        .eq("document_type", "PITCH_DECK")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const saved = company ? await getPitchDeckAnalysis(createServiceRoleClient(), company.id) : null;

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="ai_diligence">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow={t("raise_toolkit_2")}
            title={t("pitch_deck_ai_analyzer")}
            description={t("get_scored_slide_by_slide_ai_feedback_on_your")}
          />
          <PitchDeckAnalyzerClient
            hasPitchDeck={Boolean(pitchDeck)}
            pitchDeckFileName={pitchDeck?.file_name ?? null}
            pitchDeckDate={pitchDeck?.created_at ?? null}
            initialAnalysis={saved?.analysis ?? null}
            initialSavedAt={saved?.updatedAt ?? null}
          />
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
