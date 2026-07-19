import { Users, Send, HandCoins, Gauge } from "lucide-react";
import { FounderAppShell } from "@/components/FounderAppShell";
import { getTranslations } from "next-intl/server";
import { FounderPrivateMarketBoard } from "@/components/founder/FounderPrivateMarketBoard";
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

  const pledged = board.summary.pledgedTotal;
  const pledgedLabel =
    pledged > 0
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: pledged >= 1_000_000 ? "compact" : "standard", maximumFractionDigits: pledged >= 1_000_000 ? 1 : 0 }).format(pledged)
      : "$0";

  const cards = [
    { icon: Users, label: "Total investor contacts", value: board.summary.totalContacts.toLocaleString(), sub: "in the iCapOS network", tint: "var(--indigo)", bg: "var(--indigo-soft)" },
    { icon: Send, label: "Reached out", value: String(board.summary.reachedOut), sub: `of ${board.summary.investorUniverse} contacted`, tint: "var(--teal)", bg: "var(--teal-muted)" },
    { icon: HandCoins, label: "Pledged", value: pledgedLabel, sub: "soft commitments", tint: "var(--navy)", bg: "var(--navy-muted)" },
    { icon: Gauge, label: "Avg investor score", value: board.summary.avgScore != null ? String(board.summary.avgScore) : "—", sub: "across rated investors", tint: "var(--navy)", bg: "var(--navy-muted)" },
  ];

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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: c.bg, color: c.tint }}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{c.label}</span>
                    </div>
                    <div className="mt-2 font-mono text-[22px] font-semibold text-slate-900">{c.value}</div>
                    <div className="mt-1 text-xs text-slate-500">{c.sub}</div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-[var(--indigo-soft)] border-l-[3px] border-l-[var(--indigo)] bg-[var(--indigo-soft)] px-4 py-3 text-xs leading-relaxed text-slate-600">
              <span aria-hidden="true">ⓘ</span>
              <span>
                <b className="text-[var(--navy)]">Information display only.</b> Match scores reflect rules-based fit to
                your company profile. Investor identities are anonymized. Nothing here is investment advice, a
                solicitation, or a guarantee of funding.
              </span>
            </div>

            <FounderPrivateMarketBoard rows={board.rows} />
          </>
        )}
      </WorkspacePageContainer>
    </FounderAppShell>
  );
}
