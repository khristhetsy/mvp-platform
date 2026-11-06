import { MarketingShell } from "@/components/marketing/MarketingShell";
import { PrivateMarketExperience } from "@/components/marketing/PrivateMarketExperience";
import type { ListingBoardStats } from "@/components/marketing/PrivateMarketListings";
import { getMarketBoard, OUTREACH_COMPANY_WINDOW_DAYS } from "@/lib/data/market-board";
import { listApprovedCompanies, type ListedCompany } from "@/lib/listing/private-market";
import { matchScoresForInvestor } from "@/lib/matching/private-market-match";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Private Market · signed in view",
  robots: { index: false, follow: false },
};

/**
 * Signed in Private Market: an NSE style board of real platform numbers and the
 * approved companies. Investors, founders and staff; only investors can request introductions. The public /deals page keeps
 * aggregates only; this page shows approved companies' listing summaries, never documents.
 */
export default async function PrivateMarketPage() {
  const profile = await requireRole(["investor", "founder", "admin", "analyst"]);

  const isInvestor = profile.role === "investor";
  const companies = await listApprovedCompanies().catch((err): ListedCompany[] => {
    console.error("[private-market] approved companies failed", err);
    return [];
  });
  const ids = companies.map((c) => c.id);
  const [board, matches] = await Promise.all([
    getMarketBoard(ids),
    isInvestor ? matchScoresForInvestor(profile.id, ids) : Promise.resolve(new Map<string, number>()),
  ]);

  const stats: Record<string, ListingBoardStats> = {};
  for (const c of companies) {
    const b = board?.byCompany[c.id];
    stats[c.id] = {
      crrChange: b?.crr?.change ?? null,
      firstAt: b?.crr?.firstAt ?? null,
      outreachTotal: b?.outreachTotal ?? 0,
      outreachChange: b?.outreachChange ?? 0,
      match: matches.get(c.id) ?? null,
    };
  }

  return (
    <MarketingShell>
      <section className="px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-[1360px]">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] tracking-[0.16em] text-[var(--blue)]">● SIGNED IN</p>
              <h1 className="mt-1.5 text-3xl font-extrabold leading-tight tracking-tight text-[var(--navy)] md:text-4xl">
                The <span className="text-[var(--blue)]">Private Market</span>
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                Companies approved by iCapOS. Click a company for the one pager.
              </p>
            </div>
            <span className="font-mono text-[11px] tracking-[0.1em] text-slate-600">
              {companies.length} APPROVED · {companies.filter((c) => c.optedIn).length} OPTED IN
            </span>
          </div>

          <PrivateMarketExperience
            companies={companies}
            stats={stats}
            board={board}
            canRequest={isInvestor}
            outreachWindowDays={OUTREACH_COMPANY_WINDOW_DAYS}
          />
        </div>
      </section>
    </MarketingShell>
  );
}
