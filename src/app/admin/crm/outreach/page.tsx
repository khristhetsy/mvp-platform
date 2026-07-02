import { AppShell } from "@/components/AppShell";
import { AdminFounderOutreachSummary } from "@/components/AdminFounderOutreachSummary";
import { AdminInvestorActivity } from "@/components/AdminInvestorActivity";
import { AdminIntroQueue } from "@/components/admin/AdminIntroQueue";
import { formatError } from "@/lib/errors/format-error";
import { getFounderOutreachAdminSummary } from "@/lib/founder-crm/admin-outreach-summary";
import { listAdminInvestorActivity } from "@/lib/data/investor-interests";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AdminCrmOutreachPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const t = await getTranslations("irAdmin.crm");

  let setupError: string | null = null;
  let investorActivity = {
    interests: [] as Array<Record<string, unknown>>,
    introRequests: [] as Array<Record<string, unknown>>,
    savedDeals: [] as Array<Record<string, unknown>>,
  };
  let outreachSummary = {
    privateContactCount: 0,
    activeCampaignCount: 0,
    queuedMessageCount: 0,
    draftCampaignCount: 0,
    outreachTargetCount: 0,
    socialDraftCount: 0,
    socialDraftFlaggedCount: 0,
    socialDraftCopiedCount: 0,
  };

  try {
    const supabase = createServiceRoleClient();
    const [activity, outreach] = await Promise.all([
      listAdminInvestorActivity(supabase),
      getFounderOutreachAdminSummary(),
    ]);
    investorActivity = activity;
    outreachSummary = outreach;
  } catch (error) {
    setupError = formatError(error);
  }

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{t("outreach")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {t("outreachDesc")}
        </p>
      </div>

      {setupError ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Data load failed: {setupError}
        </div>
      ) : null}

      <div className="mb-8">
        <AdminFounderOutreachSummary summary={outreachSummary} />
      </div>

      {/* Intro request action queue — pending requests with Facilitate / Decline actions */}
      <div className="mb-10">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Intro request queue</h2>
        <AdminIntroQueue introRequests={investorActivity.introRequests} />
      </div>

      <AdminInvestorActivity
        interests={investorActivity.interests}
        introRequests={investorActivity.introRequests}
        savedDeals={investorActivity.savedDeals}
      />
    </AppShell>
  );
}
