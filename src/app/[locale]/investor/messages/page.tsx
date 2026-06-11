import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { MessagingThreadWorkspace } from "@/components/MessagingThreadWorkspace";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { listInvestorMessageThreads } from "@/lib/messaging/threads";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorMessagesPage() {
  const { profile, supabase, investorId } = await requireInvestorWorkspaceSession();
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
      profileSubtitle="Investor account"
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Messages</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Controlled conversations with founders after intro requests, follow-ups, and meeting scheduling.
        </p>
      </div>

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
