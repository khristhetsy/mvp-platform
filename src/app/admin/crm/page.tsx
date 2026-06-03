import { AppShell } from "@/components/AppShell";
import { AdminCrmModuleViews } from "@/components/admin/AdminCrmModuleViews";
import { formatError } from "@/lib/errors/format-error";
import { getFounderOutreachAdminSummary } from "@/lib/founder-crm/admin-outreach-summary";
import { listRecentInvestorCrmActivity } from "@/lib/data/investor-crm";
import { listAdminInvestorPipeline } from "@/lib/investor-crm/admin-pipeline";
import { listAdminMessageThreads } from "@/lib/messaging/threads";
import { listAdminInvestorActivity } from "@/lib/data/investor-interests";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminCrmPage() {
  const profile = await requireRole(["admin", "analyst"]);

  let setupError: string | null = null;
  let investorActivity = { interests: [] as Array<Record<string, unknown>>, introRequests: [] as Array<Record<string, unknown>>, savedDeals: [] as Array<Record<string, unknown>> };
  let crmActivity: Awaited<ReturnType<typeof listRecentInvestorCrmActivity>> = [];
  let pipelineRows: Awaited<ReturnType<typeof listAdminInvestorPipeline>> = [];
  let messageThreads: Awaited<ReturnType<typeof listAdminMessageThreads>>["data"] = [];
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

    const [activity, crm, threads, outreach, pipeline] = await Promise.all([
      listAdminInvestorActivity(supabase),
      listRecentInvestorCrmActivity(supabase),
      listAdminMessageThreads(supabase, 30),
      getFounderOutreachAdminSummary(),
      listAdminInvestorPipeline(supabase),
    ]);
    investorActivity = activity;
    crmActivity = crm;
    pipelineRows = pipeline;
    messageThreads = threads.data ?? [];
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
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">CRM</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Investor–company pipeline, CRM activity timeline, and relationship tracking.
        </p>
      </div>

      {setupError ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Data load failed: {setupError}
        </div>
      ) : null}

      <AdminCrmModuleViews
        crmActivity={crmActivity}
        pipelineRows={pipelineRows}
        messageThreads={messageThreads}
        outreachSummary={outreachSummary}
        investorActivity={investorActivity}
      />
    </AppShell>
  );
}
