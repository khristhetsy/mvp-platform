import { requireRole } from "@/lib/supabase/auth";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { FinancialModelClient } from "@/components/founder/FinancialModelClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Financial model" };

export default async function FounderFinancialModelPage() {
  const profile = await requireRole(["founder"]);
  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle="Financial model"
    >
      <FounderJourneyGate minStage="qualify">
        <PageHeader
          eyebrow="Raise Toolkit"
          title="Financial model"
          description="A driver-based 3-year model investors can open in Excel. Used the AI Business Plan? Your projections carry over automatically. If not, build it here — you set the drivers, we do the math."
        />
        <FinancialModelClient />
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
