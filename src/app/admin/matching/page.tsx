import { AppShell } from "@/components/AppShell";
import { AdminMatchingCenterPanel } from "@/components/admin/AdminMatchingCenterPanel";
import { AdminUncontactedMatchesPanel } from "@/components/admin/AdminUncontactedMatchesPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { formatError } from "@/lib/errors/format-error";
import { loadAdminMatchingCenterSnapshot } from "@/lib/matching/matching-center";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminMatchingPage() {
  const profile = await requireRole(["admin", "analyst"]);

  let setupError: string | null = null;
  let snapshot: Awaited<ReturnType<typeof loadAdminMatchingCenterSnapshot>> | null = null;
  let existingActivity: Array<{ investorId: string; companyId: string }> = [];

  try {
    const admin = createServiceRoleClient();
    const [snapshotResult, interestsResult, introsResult] = await Promise.all([
      loadAdminMatchingCenterSnapshot(),
      admin.from("investor_interests").select("investor_id, company_id"),
      admin.from("intro_requests").select("investor_id, company_id"),
    ]);
    snapshot = snapshotResult;

    const seen = new Set<string>();
    for (const row of [...(interestsResult.data ?? []), ...(introsResult.data ?? [])]) {
      const key = `${row.investor_id}::${row.company_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        existingActivity.push({ investorId: row.investor_id, companyId: row.company_id ?? "" });
      }
    }
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
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Admin workspace"
          title="Matching Center"
          description="Platform-wide investor–company matching intelligence using the existing CapitalOS rules engine."
        />

        {setupError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{setupError}</p>
        ) : snapshot ? (
          <>
            {/* Uncontacted high-match pairs — surface gaps in the funnel */}
            <section className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Uncontacted high-match pairs</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Investor–company pairs scoring 70%+ with no existing interest or intro request
                  </p>
                </div>
              </div>
              <AdminUncontactedMatchesPanel
                pairs={snapshot.pairs}
                existingActivity={existingActivity}
              />
            </section>

            <AdminMatchingCenterPanel snapshot={snapshot} />
          </>
        ) : null}
      </WorkspacePageContainer>
    </AppShell>
  );
}
