import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { notFound } from "next/navigation";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DueDiligenceChecklist } from "@/components/founder/DueDiligenceChecklist";

export const dynamic = "force-dynamic";

export default async function DueDiligencePage() {
  const profile = await requireRole(["founder"]);

  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "raise_toolkit_guides")) notFound();

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle="Investor due diligence"
    >
      <FounderFeatureGate featureKey="dashboard">
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader
            eyebrow="Fundraising prep"
            title="Investor due diligence checklist"
            description="Every document institutional investors typically request — organised by category with detail on format, urgency, and who asks for what."
          />
          <DueDiligenceChecklist />
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
