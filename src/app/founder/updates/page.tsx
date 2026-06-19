import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { listFounderCompanyUpdates } from "@/lib/company-updates/company-updates";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { FounderCompanyUpdatesClient } from "@/components/founder/FounderCompanyUpdatesClient";

export const dynamic = "force-dynamic";

export default async function FounderUpdatesPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();

  const { data: updates } = company
    ? await listFounderCompanyUpdates(supabase, company.id)
    : { data: [] };

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="investor_access">
        <PageHeader
          eyebrow="Founder workspace"
          title="Investor updates"
          description="Broadcast company milestones to investors watching your company. Published updates trigger in-app notifications."
        />
        <FounderCompanyUpdatesClient initialUpdates={updates ?? []} />
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
