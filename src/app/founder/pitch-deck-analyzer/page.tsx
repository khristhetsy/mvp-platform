import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { notFound } from "next/navigation";
import { PitchDeckAnalyzerClient } from "@/components/founder/PitchDeckAnalyzerClient";

export const dynamic = "force-dynamic";

export default async function PitchDeckAnalyzerPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();

  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "pitch_deck_analyzer")) notFound();

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

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="ai_diligence">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow="Raise toolkit"
            title="Pitch deck AI analyzer"
            description="Get scored, slide-by-slide AI feedback on your pitch deck from the perspective of a top VC."
          />
          <PitchDeckAnalyzerClient
            hasPitchDeck={Boolean(pitchDeck)}
            pitchDeckFileName={pitchDeck?.file_name ?? null}
            pitchDeckDate={pitchDeck?.created_at ?? null}
          />
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
