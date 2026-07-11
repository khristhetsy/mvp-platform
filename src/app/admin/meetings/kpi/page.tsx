import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { loadMeetingMeta } from "@/lib/meetings/tasks";
import { KpiClient } from "./KpiClient";

export const dynamic = "force-dynamic";

export default async function MeetingKpiPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const { departments } = await loadMeetingMeta();

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <KpiClient departments={departments} isAdmin={profile.role === "admin"} />
    </AppShell>
  );
}
