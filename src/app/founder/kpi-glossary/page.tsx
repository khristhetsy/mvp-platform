import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { notFound } from "next/navigation";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { FounderKPIGlossary } from "@/components/founder/FounderKPIGlossary";

export const dynamic = "force-dynamic";

export default async function KPIGlossaryPage() {
  const profile = await requireRole(["founder"]);

  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "raise_toolkit_guides")) notFound();

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle="KPI glossary"
    >
      <FounderFeatureGate featureKey="dashboard">
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader
            eyebrow="Financial literacy"
            title="Founder KPI glossary"
            description="Plain-English definitions, formulas, benchmarks, and calculators for every metric investors ask about."
          />
          <FounderKPIGlossary />
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
