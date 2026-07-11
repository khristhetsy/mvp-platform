import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { loadMeetingMeta } from "@/lib/meetings/tasks";
import { listConferences } from "@/lib/meetings/conferences";
import { ConferencesClient } from "./ConferencesClient";

export const dynamic = "force-dynamic";

export default async function ConferencesPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const [{ departments, staff }, conferences] = await Promise.all([loadMeetingMeta(), listConferences()]);

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <ConferencesClient initial={conferences} departments={departments} staff={staff} />
    </AppShell>
  );
}
