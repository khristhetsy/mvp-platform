import { AppShell } from "@/components/AppShell";
import { InboxTabs } from "@/components/email/InboxTabs";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminInboxPage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Inbox"
    >
      <InboxTabs />
    </AppShell>
  );
}
