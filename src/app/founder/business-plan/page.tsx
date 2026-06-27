import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { BusinessPlanGeneratorClient } from "@/components/founder/BusinessPlanGeneratorClient";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business plan" };

export default async function FounderBusinessPlanPage() {
  const profile = await requireRole(["founder"]);

  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "business_plan")) notFound();

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle="Business plan"
    >
      <FounderJourneyGate minStage="qualify">
        <PageHeader
          eyebrow="Raise Toolkit"
          title="AI Business Plan"
          description="Build an investor-ready plan in minutes. Most of it is pre-filled from your profile — you review, tweak, and approve. Your AI coach helps at every step."
        />
        <BusinessPlanGeneratorClient />
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
