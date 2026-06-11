import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { loadFounderInvestorHub } from "@/lib/founder-crm/load-founder-investor-hub";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderInvestorMatchesPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);

  let hub: Awaited<ReturnType<typeof loadFounderInvestorHub>> | null = null;

  if (company) {
    hub = await loadFounderInvestorHub(company, profile.id);
  }

  const matches = hub?.platformMatches ?? [];

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="investor_access">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow="Investors"
            title="Platform matches"
            description="CapitalOS registered investors matched to your company — separate from your private CRM."
          />

          {!company ? (
            <WorkspacePanel title="Company profile required" subtitle="Complete setup to see matches">
              <p className="text-sm text-slate-600">
                Complete your company setup to view platform investor matches.
              </p>
            </WorkspacePanel>
          ) : (
            <WorkspacePanel
              title="Matched investors"
              subtitle={`${matches.length} platform investor${matches.length !== 1 ? "s" : ""} matched`}
            >
              {matches.length === 0 ? (
                <p className="text-sm text-slate-500">No platform matches available yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {matches.map((row) => (
                    <div key={row.platformInvestorId} className="py-4 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900">
                            {row.label} · <span className="text-indigo-700">{row.matchScore}% match</span>
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {row.matchReasons.slice(0, 3).join(" · ")}
                          </p>
                        </div>
                        <Link
                          href="/founder/investors/outreach"
                          className="text-xs font-semibold text-indigo-700 hover:underline"
                        >
                          Add to outreach →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </WorkspacePanel>
          )}
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
