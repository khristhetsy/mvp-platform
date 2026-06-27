import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { notFound } from "next/navigation";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InvestorUpdateBuilder } from "@/components/founder/InvestorUpdateBuilder";

export const dynamic = "force-dynamic";

export default async function InvestorUpdatePage() {
  const profile = await requireRole(["founder"]);

  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "raise_toolkit_guides")) notFound();

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle="Investor update builder"
    >
      <FounderFeatureGate featureKey="dashboard">
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader
            eyebrow="Investor relations"
            title="Investor update builder"
            description="Build monthly or quarterly investor updates that build trust and generate introductions — with stage-appropriate tone guidance."
          />
          <InvestorUpdateBuilder />
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
