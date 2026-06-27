import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { CapTableClient } from "@/components/founder/CapTableClient";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cap table" };

export default async function FounderCapTablePage() {
  const profile = await requireRole(["founder"]);

  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "cap_table")) notFound();

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle="Cap table"
    >
      <FounderJourneyGate minStage="qualify">
        <PageHeader
          eyebrow="Raise Toolkit"
          title="Cap table"
          description="Lay out who owns what, model a round to see dilution, and export an investor-ready cap table. It saves to your Documents and counts toward readiness."
        />
        <CapTableClient />
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
