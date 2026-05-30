import { AppShell } from "@/components/AppShell";
import { AdminInvestorActivity } from "@/components/AdminInvestorActivity";
import { AdminSubscriptionSummary } from "@/components/AdminSubscriptionSummary";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { listAdminInvestorActivity } from "@/lib/data/investor-interests";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";
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
  const investorActivity = await listAdminInvestorActivity(supabase);
  const investors = uniqueInvestorsFromActivity(
    investorActivity.interests,
    investorActivity.introRequests,
    investorActivity.savedDeals,
  );

  const { data: investorProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .eq("role", "investor")
    .order("created_at", { ascending: false });

  const subscriptionMap = await listSubscriptionsByProfileIds(
    (investorProfiles ?? []).map((row) => row.id),
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
          Investor activity across marketplace interests, intro requests, and saved deals.
        </p>
      </div>

      <WorkspacePanel
        title="Investor subscriptions"
        subtitle={`${investorProfiles?.length ?? 0} investor profiles`}
      >
        {(investorProfiles ?? []).length === 0 ? (
          <p className="text-sm text-slate-600">No investor profiles yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {(investorProfiles ?? []).map((investor) => (
              <div key={investor.id} className="grid gap-3 py-4 md:grid-cols-[1fr_1.2fr]">
                <div className="text-sm">
                  <p className="font-medium text-slate-900">{investor.full_name ?? investor.email ?? "Investor"}</p>
                  {investor.email ? <p className="text-slate-500">{investor.email}</p> : null}
                  <p className="mt-1 text-xs capitalize text-slate-500">Role: {investor.role}</p>
                </div>
                <AdminSubscriptionSummary subscription={subscriptionMap.get(investor.id) ?? null} />
              </div>
            ))}
          </div>
        )}
      </WorkspacePanel>

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

      <AdminInvestorActivity
        interests={investorActivity.interests}
        introRequests={investorActivity.introRequests}
        savedDeals={investorActivity.savedDeals}
      />
    </AppShell>
  );
}
