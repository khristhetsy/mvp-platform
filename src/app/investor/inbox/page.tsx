import { AppShell } from "@/components/AppShell";
import { EmailInbox } from "@/components/email/EmailInbox";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { assertFeatureEnabled } from "@/lib/feature-controls/server";

export const dynamic = "force-dynamic";

export default async function InvestorInboxPage() {
  const { profile } = await requireInvestorWorkspaceSession();
  await assertFeatureEnabled("investor", "inbox", "/investor/dashboard");
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
