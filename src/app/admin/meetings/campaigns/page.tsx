import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { listSchedule, listCampaignResults, romiSummary } from "@/lib/meetings/campaigns";
import { CampaignsClient } from "./CampaignsClient";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const [schedule, results, romi] = await Promise.all([listSchedule(), listCampaignResults(), romiSummary()]);

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <CampaignsClient initialSchedule={schedule} initialResults={results} initialRomi={romi} />
    </AppShell>
  );
}
