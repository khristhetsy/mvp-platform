import { FounderAppShell } from "@/components/FounderAppShell";
import { EmailInbox } from "@/components/email/EmailInbox";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderInboxPage() {
  const profile = await requireRole(["founder"]);
  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle="Inbox">
      <EmailInbox />
    </FounderAppShell>
  );
}
