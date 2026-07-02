import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { getTranslations } from "next-intl/server";
import { MessagingThreadWorkspace } from "@/components/MessagingThreadWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import {
  getMessageThreadDetail,
  listInvestorMessageThreads,
  userCanAccessThread,
} from "@/lib/messaging/threads";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ threadId: string }> };

export default async function InvestorMessageThreadPage({ params }: PageProps) {
  const { threadId } = await params;
  const t = await getTranslations("appPages");
  const { profile, supabase, investorId } = await requireInvestorWorkspaceSession();

  const [threadsResult, detailResult, googleStatus] = await Promise.all([
    listInvestorMessageThreads(supabase, investorId),
    getMessageThreadDetail(supabase, threadId),
    getGoogleConnectionStatus(supabase, investorId),
  ]);

  const detail = detailResult.data;
  if (!detail || !userCanAccessThread(detail.thread, profile.id, profile.role)) {
    notFound();
  }

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle={t("investor_account")}
    >
      <PageHeader eyebrow={t("investor_workspace_2")} title={t("messages")} />

      <InvestorFeatureGate>
        <MessagingThreadWorkspace
          role="investor"
          basePath="/investor/messages"
          threads={threadsResult.data ?? []}
          selectedThreadId={threadId}
          detail={detail}
          currentUserId={profile.id}
          googleCalendarReady={googleStatus.connected}
        />
      </InvestorFeatureGate>
    </AppShell>
  );
}
