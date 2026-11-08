import { MarketingShell } from "@/components/marketing/MarketingShell";
import { PrivateMarketGate } from "@/components/marketing/PrivateMarketGate";
import { PrivateMarketHero } from "@/components/marketing/PrivateMarketHero";
import { PrivateMarketExperience } from "@/components/marketing/PrivateMarketExperience";
import type { ListingBoardStats } from "@/components/marketing/PrivateMarketListings";
import { getMarketBoard, OUTREACH_COMPANY_WINDOW_DAYS } from "@/lib/data/market-board";
import { listApprovedCompanies, type ListedCompany } from "@/lib/listing/private-market";
import { matchScoresForInvestor } from "@/lib/matching/private-market-match";
import { redirect } from "next/navigation";
import { getCurrentUserProfile, requireRole } from "@/lib/supabase/auth";

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
  // Signed out visitors get the sign in gate (it carries no company data).
  if (!(await getCurrentUserProfile())) return <PrivateMarketGate />;
  const profile = await requireRole(["investor", "founder", "admin", "analyst"]);

  const isInvestor = profile.role === "investor";
  // Investors use the same board inside their own workspace.
  if (isInvestor) redirect("/investor/opportunities");
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
      <PrivateMarketHero />
      <section className="bg-site-paper px-6 pb-12">
        <div className="relative mx-auto -mt-12 max-w-6xl">
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
