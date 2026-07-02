import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { requirePermissionPage } from "@/lib/api/permissions";
import { loadDataRoomTracker } from "@/lib/data-room/admin-tracker";
import { DataRoomTrackerClient } from "@/components/admin/DataRoomTrackerClient";

export const dynamic = "force-dynamic";

export default async function AdminDataRoomPage() {
  const t = await getTranslations("adminPages");
  const { profile } = await requirePermissionPage("manage_companies");
  const { rows, summary } = await loadDataRoomTracker();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("diligenceTracker")}
    >
      <DataRoomTrackerClient rows={rows} summary={summary} />
    </AppShell>
  );
}
