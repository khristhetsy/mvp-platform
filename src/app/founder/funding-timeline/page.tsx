import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { notFound } from "next/navigation";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { FundingTimelinePlanner } from "@/components/founder/FundingTimelinePlanner";

export const dynamic = "force-dynamic";

export default async function FundingTimelinePage() {
  const profile = await requireRole(["founder"]);

  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "raise_toolkit_guides")) notFound();

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
