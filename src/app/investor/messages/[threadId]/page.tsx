import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { MessagingThreadWorkspace } from "@/components/MessagingThreadWorkspace";
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
  const { profile, supabase, investorId } = await requireInvestorWorkspaceSession();

  const [threadsResult, detailResult] = await Promise.all([
    listInvestorMessageThreads(supabase, investorId),
    getMessageThreadDetail(supabase, threadId),
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
      profileSubtitle="Investor account"
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Messages</h1>
      </div>

      <InvestorFeatureGate>
        <MessagingThreadWorkspace
          role="investor"
          basePath="/investor/messages"
          threads={threadsResult.data ?? []}
          selectedThreadId={threadId}
          detail={detail}
          currentUserId={profile.id}
        />
      </InvestorFeatureGate>
    </AppShell>
  );
}
