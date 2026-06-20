import { FounderAppShell } from "@/components/FounderAppShell";
import { EmailInbox } from "@/components/email/EmailInbox";
import { requireRole } from "@/lib/supabase/auth";
import { assertFeatureEnabled } from "@/lib/feature-controls/server";

export const dynamic = "force-dynamic";

export default async function FounderInboxPage() {
  const profile = await requireRole(["founder"]);
  await assertFeatureEnabled("founder", "inbox", "/founder/dashboard");
  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle="Inbox">
      <EmailInbox />
    </FounderAppShell>
  );
}
