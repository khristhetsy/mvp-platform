import { AppShell } from "@/components/AppShell";
import { AdminInvestorsModuleViews } from "@/components/admin/AdminInvestorsModuleViews";
import { DraftEmailPanel } from "@/components/email/DraftEmailPanel";
import { listAdminInvestorActivity } from "@/lib/data/investor-interests";
import { getInvestorMatchingSummaries } from "@/lib/matching/admin-matching-summaries";
import { listInvestorProfilesForAdmin } from "@/lib/investor/profile";
import { loadKycReviewView } from "@/lib/investor/kyc";
import { listPriorDeals } from "@/lib/investor/prior-deals";
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

  const profileIds = investorProfiles.map((row) => row.profile_id);
  const matchingSummaries = await getInvestorMatchingSummaries(profileIds);

  const investorProfilesWithMatching = await Promise.all(
    investorProfiles.map(async (row) => ({
      ...row,
      matchingSummary: matchingSummaries.get(row.profile_id),
      // KYC docs only exist post-approval; load them so staff can verify Stage 2.
      kycReview:
        row.approval_status === "approved"
          ? await loadKycReviewView(row.id, row.investor_type)
          : undefined,
      priorDeals: row.approval_status === "approved" ? await listPriorDeals(row.id) : [],
    })),
  );

  const profileLookup = new Map(
    investorProfilesWithMatching.map((row) => [
      row.profile_id,
      { full_name: row.profiles?.full_name, email: row.profiles?.email },
    ]),
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
          profileEmail={profile.email ?? undefined}
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Investors</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Review investor onboarding submissions, approve accounts, and monitor marketplace activity.
        </p>
      </div>

      <div className="mb-6">
        <DraftEmailPanel role={profile.role} defaultTemplate="admin_investor_approval_followup" />
      </div>

      <AdminInvestorsModuleViews
        investorProfiles={investorProfilesWithMatching}
        investorActivity={investorActivity}
        investorAuthProfiles={investorAuthProfiles ?? []}
        subscriptionMap={subscriptionMap}
        requestedPlansMap={requestedPlansMap}
        profileLookup={profileLookup}
        investors={investors}
      />
    </AppShell>
  );
}
