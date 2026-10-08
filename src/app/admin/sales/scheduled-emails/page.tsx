import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { SalesHubHeader } from "../SalesHubHeader";
import { ScheduledEmailsClient } from "./ScheduledEmailsClient";

export const dynamic = "force-dynamic";

/** Sales › Scheduled emails: every email you scheduled from any send point, in one list. */
export default async function ScheduledEmailsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <ScheduledEmailsClient />
    </AppShell>
  );
}
