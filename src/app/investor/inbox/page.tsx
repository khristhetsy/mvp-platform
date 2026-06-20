import { AppShell } from "@/components/AppShell";
import { EmailInbox } from "@/components/email/EmailInbox";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorInboxPage() {
  const { profile } = await requireInvestorWorkspaceSession();
  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Inbox"
    >
      <EmailInbox />
    </AppShell>
  );
}
