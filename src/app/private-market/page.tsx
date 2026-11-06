import { MarketingShell } from "@/components/marketing/MarketingShell";
import { NseBoard } from "@/components/marketing/NseBoard";
import { PrivateMarketListings, type ListingBoardStats } from "@/components/marketing/PrivateMarketListings";
import { getMarketBoard, OUTREACH_COMPANY_WINDOW_DAYS } from "@/lib/data/market-board";
import { listDiligenceCompleteCompanies, type ListedCompany } from "@/lib/listing/private-market";
import { matchScoresForInvestor } from "@/lib/matching/private-market-match";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Private Market · signed in view",
  robots: { index: false, follow: false },
};

/**
 * Signed in Private Market: an NSE style board of real platform numbers and the
 * listed companies. Investors and staff only. The public /deals page keeps
 * aggregates only; this page never shows non listed companies or documents.
 */
export default async function PrivateMarketPage() {
  const profile = await requireRole(["investor", "admin", "analyst"]);

  const companies = await listDiligenceCompleteCompanies().catch((err): ListedCompany[] => {
    console.error("[private-market] listing failed", err);
    return [];
  });
  const ids = companies.map((c) => c.id);
  const [board, matches] = await Promise.all([
    getMarketBoard(ids),
    profile.role === "investor" ? matchScoresForInvestor(profile.id, ids) : Promise.resolve(new Map<string, number>()),
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
              <p className="font-mono text-[11px] tracking-[0.16em] text-[var(--blue)]">● SIGNED IN · INVESTOR VIEW</p>
              <h1 className="mt-1.5 text-3xl font-extrabold leading-tight tracking-tight text-[var(--navy)] md:text-4xl">
                The <span className="text-[var(--blue)]">Private Market</span>
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                Companies that opted in and completed diligence. Click a row for the one pager.
              </p>
            </div>
            <span className="font-mono text-[11px] tracking-[0.1em] text-slate-600">{companies.length} LISTED · OPTED IN</span>
          </div>

          {board ? <NseBoard data={board} companies={companies} /> : null}
          <PrivateMarketListings companies={companies} stats={stats} outreachWindowDays={OUTREACH_COMPANY_WINDOW_DAYS} />
        </div>
      </section>
    </MarketingShell>
  );
}
