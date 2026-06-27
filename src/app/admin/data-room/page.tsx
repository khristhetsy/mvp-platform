import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { loadDataRoomTracker } from "@/lib/data-room/admin-tracker";
import { DataRoomTrackerClient } from "@/components/admin/DataRoomTrackerClient";

export const dynamic = "force-dynamic";

export default async function AdminDataRoomPage() {
  const { profile } = await requirePermissionPage("manage_companies");
  const { rows, summary } = await loadDataRoomTracker();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Diligence tracker"
    >
      <DataRoomTrackerClient rows={rows} summary={summary} />
    </AppShell>
  );
}
