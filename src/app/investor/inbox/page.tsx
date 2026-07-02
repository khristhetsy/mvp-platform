import { AppShell } from "@/components/AppShell";
import { InboxTabs } from "@/components/email/InboxTabs";
import { getTranslations } from "next-intl/server";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { assertFeatureEnabled } from "@/lib/feature-controls/server";

export const dynamic = "force-dynamic";

export default async function InvestorInboxPage() {
  const { profile } = await requireInvestorWorkspaceSession();
  const t = await getTranslations("appPages");
  await assertFeatureEnabled("investor", "inbox", "/investor/dashboard");
  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle={t("inbox")}
    >
      <InboxTabs />
    </AppShell>
  );
}
