import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../../../IrHubTabs";
import { TasksClient } from "./TasksClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "IR Tasks" };

export default async function IrTasksPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ month?: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  const sp = await searchParams;
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations Hub">
      <IrHubHeader />
      <TasksClient projectId={id} meId={profile.id} initialMonth={sp.month ?? null} />
    </AppShell>
  );
}
