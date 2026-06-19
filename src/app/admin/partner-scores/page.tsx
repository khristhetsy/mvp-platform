import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { PartnerScoreCard } from "@/components/admin/PartnerScoreCard";
import { loadPartnerScore } from "@/lib/investor-rating/load";
import type { PartnerScore } from "@/lib/investor-rating/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const MAX_INVESTORS = 12;

export default async function AdminPartnerScoresPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const supabase = createServiceRoleClient();

  type InvestorRow = { profile_id: string; firm_name: string | null; investor_type: string | null };
  const investorsRes = await supabase
    .from("investor_profiles")
    .select("profile_id, firm_name, investor_type")
    .limit(MAX_INVESTORS);
  const investors = ((investorsRes as { data: InvestorRow[] | null }).data ?? []);

  type ProfileRow = { id: string; full_name: string | null; email: string | null };
  const profileNames = new Map<string, ProfileRow>();
  if (investors.length > 0) {
    const namesRes = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in(
        "id",
        investors.map((i) => i.profile_id),
      );
    for (const row of ((namesRes as { data: ProfileRow[] | null }).data ?? [])) {
      profileNames.set(row.id, row);
    }
  }

  const rated: Array<{ name: string; subtitle: string; rating: PartnerScore }> = await Promise.all(
    investors.map(async (inv) => {
      const p = profileNames.get(inv.profile_id);
      const rating = await loadPartnerScore(supabase, inv.profile_id);
      return {
        name: inv.firm_name ?? p?.full_name ?? p?.email ?? "Investor",
        subtitle: [inv.investor_type ?? "investor", `${rating.sampleSize} engaged`].join(" · "),
        rating,
      };
    }),
  );

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
          eyebrow="Investors · validation"
          title="Partner Scores"
          description="Admin-only Phase 1 view to validate the Partner Score against real data before any investor- or founder-facing surface. Scores are computed live from on-platform activity."
        />

        {rated.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-500">
            No investor profiles found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rated.map((r) => (
              <PartnerScoreCard key={r.name + r.subtitle} name={r.name} subtitle={r.subtitle} rating={r.rating} />
            ))}
          </div>
        )}
      </WorkspacePageContainer>
    </AppShell>
  );
}
