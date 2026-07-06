import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { PitchDeckWizardClient } from "@/components/founder/PitchDeckWizardClient";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pitch deck" };

export default async function FounderPitchDeckPage() {
  const profile = await requireRole(["founder"]);
  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "business_plan")) notFound();

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle="Pitch deck">
      <FounderJourneyGate minStage="qualify">
        <PageHeader
          eyebrow="Raise toolkit"
          title="AI Pitch Deck"
          description="Turn your business plan into an investor-ready deck. Slides are pre-filled from your plan — review, tweak, and approve. Download as PDF or PowerPoint, or share a read-only link."
        />
        <PitchDeckWizardClient />
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
