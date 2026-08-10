import { FounderAppShell } from "@/components/FounderAppShell";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { requireRole } from "@/lib/supabase/auth";
import { LearningScheduleClient } from "./LearningScheduleClient";

export const dynamic = "force-dynamic";

export default async function LearningSchedulePage() {
  const profile = await requireRole(["founder"]);
  const { company } = await getActiveCompanyForUser(profile);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <LearningScheduleClient />
    </FounderAppShell>
  );
}
