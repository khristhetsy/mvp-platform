import { notFound } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { RegCfGeneratorClient } from "@/components/founder/RegCfGeneratorClient";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderRegCfPage() {
  const profile = await requireRole(["founder"]);

  // Off by default — only reachable once an admin enables founder:regcf.
  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "regcf")) notFound();

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle="Reg CF Materials"
    >
      <FounderJourneyGate minStage="qualify">
        <PageHeader
          eyebrow="Raise Toolkit"
          title="Reg CF Materials Generator"
          description="AI-draft your Regulation Crowdfunding documents from your company profile. You edit, download, and own them — and run your raise on your own. Drafts only; have counsel review."
        />
        <RegCfGeneratorClient />
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
