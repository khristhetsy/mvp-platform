import { LayoutGrid, Star, Gauge } from "lucide-react";
import { FounderAppShell } from "@/components/FounderAppShell";
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
  const company = await ensureFounderCompanyForUser(profile);

  const board = company
    ? await loadFounderInvestorBoard(company)
    : { rows: [], summary: { investorUniverse: 0, strongCount: 0, avgMatch: null } };

  const cards = [
    { icon: LayoutGrid, label: "Investor universe", value: String(board.summary.investorUniverse), sub: "approved on the platform", tint: "var(--indigo)", bg: "var(--indigo-soft)" },
    { icon: Star, label: "Strong fits", value: String(board.summary.strongCount), sub: "match 75+ to your company", tint: "var(--teal)", bg: "var(--teal-muted)" },
    { icon: Gauge, label: "Avg match", value: board.summary.avgMatch != null ? board.summary.avgMatch.toFixed(1) : "—", sub: "across ranked investors", tint: "var(--navy)", bg: "var(--navy-muted)" },
  ];

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Founder workspace"
          title="Private Market"
          description="Approved investors ranked by fit to your company. Identities are hidden until interest is mutual — you see fit, criteria, and focus."
        />

        {!company ? (
          <WorkspacePanel title="Company profile required" subtitle="Link a company to see your investor matches">
            <p className="text-sm text-slate-600">
              Complete your company setup to see investors ranked to your raise here.
            </p>
          </WorkspacePanel>
        ) : (
          <>
            <FounderPrivateMarketTicker rows={board.rows} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
