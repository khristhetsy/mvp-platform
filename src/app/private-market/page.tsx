import { MarketClocks } from "@/components/marketing/MarketClocks";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { FounderReadinessBoard, FounderStatsCard } from "@/components/marketing/FounderReadinessBoard";
import { PrivateMarketListings } from "@/components/marketing/PrivateMarketListings";
import { getReadinessBoard } from "@/lib/data/readiness-board";
import { listDiligenceCompleteCompanies, type ListedCompany } from "@/lib/listing/private-market";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Private Market · signed in view",
  robots: { index: false, follow: false },
};

/**
 * Signed in Private Market: the deals board design with the real listed companies.
 * Investors and staff only. The public /deals page keeps aggregates only.
 */
export default async function PrivateMarketPage() {
  await requireRole(["investor", "admin", "analyst"]);

  const board = await getReadinessBoard();
  const companies = await listDiligenceCompleteCompanies().catch((err): ListedCompany[] => {
    console.error("[private-market] listing failed", err);
    return [];
  });

  return (
    <MarketingShell>
      <section
        className="px-4 py-12 lg:px-8 lg:py-16"
        style={{ background: "radial-gradient(960px 460px at 75% -10%, var(--blue-muted), transparent 70%)" }}
      >
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--blue-border)] bg-[var(--blue-muted)] px-3.5 py-1.5 font-mono text-[11.5px] text-[var(--blue)]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--blue)]" />
              Signed in · investor view
            </span>
            <h1 className="mt-5 max-w-[16ch] text-4xl font-semibold leading-[1.08] tracking-tight text-[var(--navy)] md:text-5xl">
              The <span className="text-[var(--blue)]">Private Market</span> where readiness meets capital.
            </h1>
            <p className="mt-5 max-w-[46ch] text-base leading-7 text-slate-600">
              Companies that completed diligence and opted in to be listed. You see the listing summary only, never
              documents. Shown for informational purposes only and not investment recommendations.
            </p>
          </div>
          {board ? <FounderStatsCard board={board} /> : null}
        </div>
      </section>

      <section className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-5">
          <MarketClocks />
          <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
            {board && board.scoredFounders > 0 ? <FounderReadinessBoard board={board} /> : <div />}
            <div className="flex flex-col gap-5">
              <PrivateMarketListings companies={companies} />
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[var(--shadow-card)]">
                <h3 className="text-[15px] font-semibold text-[var(--navy)]">Sector board</h3>
                <p className="mt-1.5 text-[13px] leading-6 text-slate-600">
                  A sector tile appears once 3 or more scored companies share an industry, so no single company can be
                  picked out.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
