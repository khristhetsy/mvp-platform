import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { FounderMatchingCenterPanel } from "@/components/founder/FounderMatchingCenterPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { formatError } from "@/lib/errors/format-error";
import { loadFounderMatchingCenter } from "@/lib/matching/matching-center";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderMatchingPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);

  let setupError: string | null = null;
  let snapshot: Awaited<ReturnType<typeof loadFounderMatchingCenter>> | null = null;

  if (company) {
    try {
      snapshot = await loadFounderMatchingCenter(company);
    } catch (error) {
      setupError = formatError(error);
    }
  }

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="investor_access">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow={t("founder_workspace_2")}
            title={t("matching_center")}
            description={t("ranked_platform_investor_matches_for_your_comp")}
          />

          {!company ? (
            <WorkspacePanel title={t("company_profile_required")} subtitle={t("link_a_company_to_view_investor_matches")}>
              <p className="text-sm text-slate-600">
                Complete your company setup to see ranked investor matches and fit signals here.
              </p>
            </WorkspacePanel>
          ) : setupError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{setupError}</p>
          ) : snapshot ? (
            <FounderMatchingCenterPanel snapshot={snapshot} />
          ) : null}
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
