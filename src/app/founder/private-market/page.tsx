import { FounderAppShell } from "@/components/FounderAppShell";
import { getTranslations } from "next-intl/server";
import { FounderPrivateMarketBoard } from "@/components/founder/FounderPrivateMarketBoard";
import { FounderPrivateMarketSummaryCards } from "@/components/founder/FounderPrivateMarketSummaryCards";
import { FounderPrivateMarketTicker } from "@/components/founder/FounderPrivateMarketTicker";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { loadFounderInvestorBoard } from "@/lib/founder/private-market";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderPrivateMarketPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);

  const board = company
    ? await loadFounderInvestorBoard(company)
    : {
        rows: [],
        summary: {
          investorUniverse: 0,
          totalContacts: 0,
          reachedOut: 0,
          pledgedTotal: 0,
          strongCount: 0,
          avgMatch: null,
          avgScore: null,
        },
      };

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow={t("founder_workspace_2")}
          title={t("private_market")}
          description={t("approved_investors_ranked_by_fit_to_your_compa")}
        />

        {!company ? (
          <WorkspacePanel title={t("company_profile_required")} subtitle={t("link_a_company_to_see_your_investor_matches")}>
            <p className="text-sm text-slate-600">
              Complete your company setup to see investors ranked to your raise here.
            </p>
          </WorkspacePanel>
        ) : (
          <>
            <FounderPrivateMarketTicker rows={board.rows} />

            <FounderPrivateMarketSummaryCards summary={board.summary} rankedCount={board.rows.length} />

            <div className="flex items-start gap-2.5 rounded-xl border border-[var(--indigo-soft)] border-l-[3px] border-l-[var(--indigo)] bg-[var(--indigo-soft)] px-4 py-3 text-xs leading-relaxed text-slate-600">
              <span aria-hidden="true">ⓘ</span>
              <span>
                <b className="text-[var(--navy)]">Information display only.</b> Match scores reflect rules-based fit to
                your company profile. Contact details are hidden and introductions run through iCapOS. Nothing here is
                investment advice, a solicitation, or a guarantee of funding.
              </span>
            </div>

            <FounderPrivateMarketBoard rows={board.rows} />
          </>
        )}
      </WorkspacePageContainer>
    </FounderAppShell>
  );
}
