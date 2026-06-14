import { requireRole } from "@/lib/supabase/auth";
import { listTasks, listInternalUsers } from "@/lib/tasks/db";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import type { GoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { TasksClient } from "./TasksClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team Tasks" };

export default async function AdminTasksPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const admin   = createServiceRoleClient();
  const [tasks, users, googleStatus] = await Promise.all([
    listTasks(),
    listInternalUsers(),
    getGoogleConnectionStatus(admin, profile.id),
  ]);

  return (
    <TasksClient
      initialTasks={tasks}
      internalUsers={users}
      currentUserId={profile.id}
      googleConnected={googleStatus.connected}
      googleStatus={googleStatus}
    />
  );
}

export type { GoogleConnectionStatus };
