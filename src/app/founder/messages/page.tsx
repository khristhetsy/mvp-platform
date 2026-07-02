import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { MessagingThreadWorkspace } from "@/components/MessagingThreadWorkspace";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { listFounderMessageThreads } from "@/lib/messaging/threads";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderMessagesPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();

  const [threadsResult, googleStatus] = await Promise.all([
    company ? listFounderMessageThreads(supabase, profile.id, company.id) : Promise.resolve({ data: [] }),
    getGoogleConnectionStatus(supabase, profile.id),
  ]);

  const threads = threadsResult.data ?? [];

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">{t("founder_workspace")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{t("messages")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Controlled conversations with investors who requested intros or follow-ups. No private investor preferences
          are shown here.
        </p>
      </div>

      <FounderFeatureGate featureKey="investor_access">
        {!company ? (
          <p className="text-sm text-slate-600">{t("complete_company_onboarding_to_enable_messagin")}</p>
        ) : (
          <MessagingThreadWorkspace
            role="founder"
            basePath="/founder/messages"
            threads={threads}
            selectedThreadId={null}
            detail={null}
            currentUserId={profile.id}
            googleCalendarReady={googleStatus.connected}
          />
        )}
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
