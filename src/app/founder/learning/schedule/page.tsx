import { FounderAppShell } from "@/components/FounderAppShell";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";
import { LearningScheduleClient } from "./LearningScheduleClient";

export const dynamic = "force-dynamic";

export default async function LearningSchedulePage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <LearningScheduleClient />
    </FounderAppShell>
  );
}
