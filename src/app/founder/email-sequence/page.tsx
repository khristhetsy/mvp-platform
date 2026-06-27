import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { notFound } from "next/navigation";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EmailSequenceBuilder } from "@/components/founder/EmailSequenceBuilder";

export const dynamic = "force-dynamic";

export default async function EmailSequencePage() {
  const profile = await requireRole(["founder"]);

  const supabase = await createServerSupabaseClient();
  const flags = await loadFeatureFlags(supabase);
  if (!isFeatureEnabled(flags, "founder", "raise_toolkit_guides")) notFound();

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle="Email sequence builder"
    >
      <FounderFeatureGate featureKey="dashboard">
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader
            eyebrow="Investor outreach"
            title="Email sequence builder"
            description="4-touch outreach sequences tailored to VC, angel, family office, and corporate investors — with timing guidance and copy you can send today."
          />
          <EmailSequenceBuilder />
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
