import { AppShell } from "@/components/AppShell";
import { AdminInvestorActivity } from "@/components/AdminInvestorActivity";
import { AdminInvestorReviewCard } from "@/components/AdminInvestorReviewCard";
import { AdminSubscriptionSummary } from "@/components/AdminSubscriptionSummary";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { listAdminInvestorActivity } from "@/lib/data/investor-interests";
import { listInvestorProfilesForAdmin } from "@/lib/investor/profile";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";
import { getRequestedPlansByProfileIds } from "@/lib/billing/requested-plan";
import { listSubscriptionsByProfileIds } from "@/lib/subscriptions/get-subscription";

export const dynamic = "force-dynamic";

function uniqueInvestorsFromActivity(
  interests: Array<Record<string, unknown>>,
  introRequests: Array<Record<string, unknown>>,
  savedDeals: Array<Record<string, unknown>>,
) {
  const investors = new Map<
    string,
    { id: string | null; name: string; email: string | null; lastSeen: string }
  >();

  for (const row of [...interests, ...introRequests, ...savedDeals]) {
    const profile = (row as { profiles?: { id?: string; full_name?: string | null; email?: string | null } | null })
      .profiles;
    const email = profile?.email ?? null;
    const name = profile?.full_name ?? email ?? "Unknown investor";
    const key = profile?.id ?? email ?? name;
    const createdAt = String((row as { created_at?: string }).created_at ?? "");
    const existing = investors.get(key);

    if (!existing || createdAt > existing.lastSeen) {
      investors.set(key, { id: profile?.id ?? null, name, email, lastSeen: createdAt });
    }
  }

  return Array.from(investors.values()).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

export default async function AdminInvestorsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const supabase = createServiceRoleClient();
  const [investorActivity, investorProfiles] = await Promise.all([
    listAdminInvestorActivity(supabase),
    listInvestorProfilesForAdmin(),
  ]);

  const investors = uniqueInvestorsFromActivity(
    investorActivity.interests,
    investorActivity.introRequests,
    investorActivity.savedDeals,
  );

  const pendingQueue = investorProfiles.filter(
    (row) => row.approval_status === "submitted" || row.approval_status === "changes_requested",
  );

  const { data: investorAuthProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .eq("role", "investor")
    .order("created_at", { ascending: false });

  const subscriptionMap = await listSubscriptionsByProfileIds(
    (investorAuthProfiles ?? []).map((row) => row.id),
  );
  const requestedPlansMap = await getRequestedPlansByProfileIds(
    (investorAuthProfiles ?? []).map((row) => row.id),
  );

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Investors</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Review investor onboarding submissions, approve accounts, and monitor marketplace activity.
        </p>
      </div>

      <WorkspacePanel
        title="Investor approval queue"
        subtitle={`${pendingQueue.length} profiles awaiting review`}
      >
        {pendingQueue.length === 0 ? (
          <p className="text-sm text-slate-600">No investor profiles pending approval.</p>
        ) : (
          <div className="grid gap-5">
            {pendingQueue.map((row) => (
              <AdminInvestorReviewCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </WorkspacePanel>

      <div className="mt-8">
        <WorkspacePanel
          title="All investor profiles"
          subtitle={`${investorProfiles.length} onboarding records`}
        >
          <div className="grid gap-5">
            {investorProfiles
              .filter((row) => !pendingQueue.some((pending) => pending.id === row.id))
              .map((row) => (
                <AdminInvestorReviewCard key={row.id} row={row} />
              ))}
          </div>
        </WorkspacePanel>
      </div>

      <div className="mt-8">
        <WorkspacePanel
          title="Investor subscriptions"
          subtitle={`${investorAuthProfiles?.length ?? 0} investor auth profiles`}
        >
          {(investorAuthProfiles ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">No investor profiles yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(investorAuthProfiles ?? []).map((investor) => (
                <div key={investor.id} className="grid gap-3 py-4 md:grid-cols-[1fr_1.2fr]">
                  <div className="text-sm">
                    <p className="font-medium text-slate-900">{investor.full_name ?? investor.email ?? "Investor"}</p>
                    {investor.email ? <p className="text-slate-500">{investor.email}</p> : null}
                  </div>
                  <AdminSubscriptionSummary
                    subscription={subscriptionMap.get(investor.id) ?? null}
                    requestedPlan={requestedPlansMap.get(investor.id) ?? null}
                  />
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </div>

      <div className="mt-8">
        <WorkspacePanel
          title="Investor directory"
          subtitle={`${investors.length} investors with recorded activity`}
        >
          {investors.length === 0 ? (
            <p className="text-sm text-slate-600">No investor activity yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {investors.map((investor) => (
                <div key={`${investor.email ?? investor.name}`} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{investor.name}</p>
                    {investor.email ? <p className="text-slate-500">{investor.email}</p> : null}
                  </div>
                  <p className="text-xs text-slate-500">
                    Last activity{" "}
                    {investor.lastSeen
                      ? new Date(investor.lastSeen).toLocaleDateString("en-US", { timeZone: "UTC" })
                      : "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </div>

      <div className="mt-8">
        <AdminInvestorActivity
          interests={investorActivity.interests}
          introRequests={investorActivity.introRequests}
          savedDeals={investorActivity.savedDeals}
        />
      </div>
    </AppShell>
  );
}
