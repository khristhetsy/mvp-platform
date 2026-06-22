import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listTasks } from "@/lib/admin-tasks/queries";
import { TasksView } from "@/components/admin-tasks/TasksView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tasks" };

export default async function AdminTasksPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const admin = createServiceRoleClient();
  const tasks = await listTasks(admin).catch(() => []);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Tasks"
    >
      <TasksView initialTasks={tasks} />
    </AppShell>
  );
}
