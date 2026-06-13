import { requireRole } from "@/lib/supabase/auth";
import { listTasks, listInternalUsers } from "@/lib/tasks/db";
import { TasksClient } from "./TasksClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team Tasks" };

export default async function AdminTasksPage() {
  const profile       = await requireRole(["admin", "analyst"]);
  const [tasks, users] = await Promise.all([listTasks(), listInternalUsers()]);

  return (
    <TasksClient
      initialTasks={tasks}
      internalUsers={users}
      currentUserId={profile.id}
    />
  );
}
