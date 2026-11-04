// GET /api/mobile/investor-deals  (Authorization: Bearer <supabase access token>)
// The Deals tab for the phone: recommended matches (best fits first, with the match score), the watchlist and the
// interest pipeline. Same loaders as /investor/matches, /investor/watchlist and /investor/interest-pipeline. Read only.
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { investorCompanyLabel, loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { loadInvestorRecommendedMatches } from "@/lib/matching/load-investor-recommendations";
import { withBearerInvestor } from "../_bearer-investor";

export const dynamic = "force-dynamic";

function amountLabel(amount: number | null | undefined, band: string | null | undefined): string | null {
  if (band && band.trim()) return band.trim();
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${Math.round(amount)}`;
}

export async function GET(req: Request) {
  const result = await withBearerInvestor(req, async ({ profile }) => {
    const supabase = await createServerSupabaseClient();
    const [{ matches }, { workspace }] = await Promise.all([
      loadInvestorRecommendedMatches(supabase, profile.id, 50),
      loadInvestorWorkspacePageData(profile.id, 1),
    ]);
    return {
      matches: matches.map((m) => ({
        id: m.company.id,
        name: m.company.companyName,
        industry: m.company.industry,
        stage: m.company.stage,
        location: m.company.geography,
        raise: amountLabel(m.company.fundingAmount, m.company.fundingBand),
        score: Math.round(m.matchScore),
        path: `/investor/opportunities/${m.company.id}/report`,
      })),
      watchlist: workspace.savedDeals.map((d) => ({
        id: d.company_id,
        name: investorCompanyLabel(d),
        savedAt: d.created_at,
        path: `/investor/opportunities/${d.company_id}/report`,
      })),
      interests: workspace.interests.map((i) => ({
        id: i.company_id ?? i.id,
        name: investorCompanyLabel(i),
        status: i.status,
        at: i.created_at,
        path: i.company_id ? `/investor/opportunities/${i.company_id}/report` : "/investor/interest-pipeline",
      })),
    };
  });
  if (!result.ok) return NextResponse.json({ error: "unauthorized" }, { status: result.status });
  return NextResponse.json(result.value, { headers: { "Cache-Control": "no-store" } });
}
