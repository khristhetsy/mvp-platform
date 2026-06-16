import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { FundingTimelinePlanner } from "@/components/founder/FundingTimelinePlanner";

export const dynamic = "force-dynamic";

export default async function FundingTimelinePage() {
  const profile = await requireRole(["founder"]);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle="Funding timeline planner"
    >
      <FounderFeatureGate featureKey="dashboard">
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader
            eyebrow="Fundraising"
            title="Funding timeline planner"
            description="Reverse-engineer your raise calendar from close date. See every phase, what to do in each, and how many meetings you need to close."
          />
          <FundingTimelinePlanner />
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
