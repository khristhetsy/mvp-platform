import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getConference } from "@/lib/meetings/conferences";
import { ConferenceDetailClient } from "./ConferenceDetailClient";

export const dynamic = "force-dynamic";

export default async function ConferenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  const { conference, sessions } = await getConference(id);

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <ConferenceDetailClient conference={conference} sessions={sessions} />
    </AppShell>
  );
}
