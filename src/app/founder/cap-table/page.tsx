import { requireRole } from "@/lib/supabase/auth";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { CapTableClient } from "@/components/founder/CapTableClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cap table" };

export default async function FounderCapTablePage() {
  const profile = await requireRole(["founder"]);
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
