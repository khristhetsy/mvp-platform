import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../../../../../IrHubTabs";
import { MatchingQueueClient } from "./MatchingQueueClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Matching queue" };

export default async function IrMatchingPage({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id, taskId } = await params;
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations Hub">
      <IrHubHeader />
      <MatchingQueueClient projectId={id} taskId={taskId} />
    </AppShell>
  );
}
