import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../../../../IrHubTabs";
import { TaskFormClient } from "./TaskFormClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "IR Task" };

export default async function IrTaskPage({ params, searchParams }: { params: Promise<{ id: string; taskId: string }>; searchParams: Promise<{ tab?: string; added?: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { taskId } = await params;
  const sp = await searchParams;
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations Hub">
      <IrHubHeader />
      <TaskFormClient taskId={taskId} meId={profile.id} initialTab={sp.tab ?? null} added={sp.added ? Number(sp.added) : 0} />
    </AppShell>
  );
}
