import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { loadBoard } from "@/lib/meetings/foundation";
import { MeetingBoardClient } from "./MeetingBoardClient";

export const dynamic = "force-dynamic";

export default async function MeetingBoardPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { sessionId } = await params;
  const board = await loadBoard(sessionId);

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <MeetingBoardClient initial={board} isAdmin={profile.role === "admin"} />
    </AppShell>
  );
}
