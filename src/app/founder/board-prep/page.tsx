import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { BoardMeetingPrepKit } from "@/components/founder/BoardMeetingPrepKit";

export const dynamic = "force-dynamic";

export default async function BoardPrepPage() {
  const profile = await requireRole(["founder"]);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle="Board meeting prep"
    >
      <FounderFeatureGate featureKey="dashboard">
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader
            eyebrow="Governance"
            title="Board meeting prep kit"
            description="Agenda builder, metrics snapshot, and pre-read template — for seed and Series A boards."
          />
          <BoardMeetingPrepKit />
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
