import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../../../../../IrHubTabs";
import { MatchingQueueClient } from "./MatchingQueueClient";
import { readQueueView } from "@/lib/ir/week-pager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Matching queue" };

export default async function IrMatchingPage({ params, searchParams }: { params: Promise<{ id: string; taskId: string }>; searchParams: Promise<{ mode?: string; group?: string; open?: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id, taskId } = await params;
  // Tab, group by and open groups carried over by the week pager.
  const view = readQueueView(await searchParams);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations">
      <IrHubHeader back={false} />
      {/* key: a new week is a fresh queue (no selections or filters carried over). */}
      <MatchingQueueClient key={taskId} projectId={id} taskId={taskId} initialView={view} />
    </AppShell>
  );
}
