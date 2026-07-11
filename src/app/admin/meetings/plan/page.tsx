import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { loadMeetingMeta } from "@/lib/meetings/tasks";
import { PlanClient } from "./PlanClient";

export const dynamic = "force-dynamic";

export default async function MeetingPlanPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const { departments, staff } = await loadMeetingMeta();

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <PlanClient departments={departments} staff={staff} />
    </AppShell>
  );
}
