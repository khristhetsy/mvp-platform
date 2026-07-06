import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { listAssignableStaff } from "@/lib/sales/settings";
import { SalesHubHeader } from "../SalesHubHeader";
import { TasksClient } from "./TasksClient";

export const dynamic = "force-dynamic";

export default async function SalesTasksPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const staff = await listAssignableStaff();
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <TasksClient staff={staff} />
    </AppShell>
  );
}
