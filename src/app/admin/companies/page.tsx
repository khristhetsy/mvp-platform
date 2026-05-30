import { AppShell } from "@/components/AppShell";
import { AdminActionHealthProvider } from "@/components/AdminActionHealthProvider";
import { AdminCompanyCard } from "@/components/AdminCompanyCard";
import { formatError, RouteDataDiagnostics } from "@/components/RouteDataDiagnostics";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { listAdminCompanies, mapAdminCompaniesToCardData } from "@/lib/data/admin";
import { getRequestedPlansByProfileIds } from "@/lib/billing/requested-plan";
import { listSubscriptionsByProfileIds } from "@/lib/subscriptions/get-subscription";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage() {
  const profile = await requireRole(["admin", "analyst"]);

  const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  let loadError: string | null = null;
  let companyCards = mapAdminCompaniesToCardData([]);
  let rawCompanyCount: number | null = null;

  try {
    const supabase = createServiceRoleClient();
    const companies = await listAdminCompanies(supabase);
    rawCompanyCount = companies.length;
    const founderIds = companies.map((company) => company.founder_id).filter(Boolean);
    const [subscriptionsByProfileId, requestedPlansByProfileId] = await Promise.all([
      listSubscriptionsByProfileIds(founderIds),
      getRequestedPlansByProfileIds(founderIds),
    ]);
    companyCards = mapAdminCompaniesToCardData(companies, subscriptionsByProfileId, requestedPlansByProfileId);
  } catch (error) {
    loadError = formatError(error);
  }

  const pendingCount = companyCards.filter((company) => company.review_status === "pending").length;

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <AdminActionHealthProvider
        userId={profile.id}
        userRole={profile.role}
        serviceRoleConfigured={serviceRoleConfigured}
      >
        <RouteDataDiagnostics
          route="/admin/companies"
          userId={profile.id}
          profileRole={profile.role}
          entries={[
            {
              dataFunction: "listAdminCompanies() via createServiceRoleClient()",
              count: rawCompanyCount,
              error: loadError,
              note: serviceRoleConfigured
                ? "Service role env present"
                : "SUPABASE_SERVICE_ROLE_KEY missing — fetch will fail",
            },
          ]}
        />

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Companies</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Review submissions, manage publication, and control marketplace visibility.
          </p>
        </div>

        <WorkspacePanel
          title="Company submissions"
          subtitle={`${companyCards.length} companies · ${pendingCount} pending review`}
        >
          <div className="grid gap-5">
            {loadError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-sm text-red-800">
                Failed to load companies: {loadError}
              </div>
            ) : companyCards.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-sm text-amber-900">
                listAdminCompanies() returned 0 records. No companies in database or query returned empty.
              </div>
            ) : (
              companyCards.map((company) => <AdminCompanyCard key={company.id} company={company} />)
            )}
          </div>
        </WorkspacePanel>
      </AdminActionHealthProvider>
    </AppShell>
  );
}
