import { AppShell } from "@/components/AppShell";
import { InboxTabs } from "@/components/email/InboxTabs";
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
      <InboxTabs />
    </AppShell>
  );
}
