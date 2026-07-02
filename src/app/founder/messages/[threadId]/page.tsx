import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { MessagingThreadWorkspace } from "@/components/MessagingThreadWorkspace";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import {
  getMessageThreadDetail,
  listFounderMessageThreads,
  userCanAccessThread,
} from "@/lib/messaging/threads";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ threadId: string }> };

export default async function FounderMessageThreadPage({ params }: PageProps) {
  const { threadId } = await params;
  const t = await getTranslations("appPages");
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();

  if (!company) {
    notFound();
  }

  const [threadsResult, detailResult, googleStatus] = await Promise.all([
    listFounderMessageThreads(supabase, profile.id, company.id),
    getMessageThreadDetail(supabase, threadId),
    getGoogleConnectionStatus(supabase, profile.id),
  ]);

  const detail = detailResult.data;
  if (!detail || !userCanAccessThread(detail.thread, profile.id, profile.role)) {
    notFound();
  }

  if (detail.thread.company_id !== company.id) {
    notFound();
  }

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company.company_name}
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">{t("founder_workspace")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{t("messages")}</h1>
      </div>

      <FounderFeatureGate featureKey="investor_access">
        <MessagingThreadWorkspace
          role="founder"
          basePath="/founder/messages"
          threads={threadsResult.data ?? []}
          selectedThreadId={threadId}
          detail={detail}
          currentUserId={profile.id}
          googleCalendarReady={googleStatus.connected}
        />
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
