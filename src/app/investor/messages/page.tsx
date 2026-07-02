import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { getTranslations } from "next-intl/server";
import { MessagingThreadWorkspace } from "@/components/MessagingThreadWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { listInvestorMessageThreads } from "@/lib/messaging/threads";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorMessagesPage() {
  const { profile, supabase, investorId } = await requireInvestorWorkspaceSession();
  const t = await getTranslations("appPages");
  const [threadsResult, googleStatus] = await Promise.all([
    listInvestorMessageThreads(supabase, investorId),
    getGoogleConnectionStatus(supabase, investorId),
  ]);
  const threads = threadsResult.data ?? [];

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle={t("investor_account")}
    >
      <PageHeader
        eyebrow={t("investor_workspace_2")}
        title={t("messages")}
        description={t("controlled_conversations_with_founders_after_i")}
      />

      <InvestorFeatureGate>
        <MessagingThreadWorkspace
          role="investor"
          basePath="/investor/messages"
          threads={threads}
          selectedThreadId={null}
          detail={null}
          currentUserId={profile.id}
          googleCalendarReady={googleStatus.connected}
        />
      </InvestorFeatureGate>
    </AppShell>
  );
}
