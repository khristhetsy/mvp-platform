import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { loadFounderMatchingCenter } from "@/lib/matching/founder-matching-center";

export const dynamic = "force-dynamic";

function untyped(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}
function titleCase(s: string): string {
  return s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// GET — the shared InvestorDetail (fit breakdown + criteria) for one pipeline
// investor, so the CRM card can open the same popup Automated outreach uses.
// Platform-matched investors get live match data; manual ones get a basic view.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { supabase, profile } = auth;
  const { id } = await params;

  const { data: inv } = await untyped(supabase)
    .from("pipeline_investors")
    .select("name,investor_type,investment_size,pledge_amount,match_score,focus_sectors,preferred_stages,location,platform_investor_id")
    .eq("id", id)
    .eq("founder_id", profile.id)
    .maybeSingle();

  if (!inv) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const band = (score: number) => (score >= 70 ? "high" : score >= 45 ? "mid" : "low");

  // Platform-matched → re-fetch live fit data from the matching engine.
  if (inv.platform_investor_id) {
    try {
      const company = await ensureFounderCompanyForUser(profile);
      if (company) {
        const data = await loadFounderMatchingCenter(company);
        const card = data.cards.find((c) => c.ref === inv.platform_investor_id);
        if (card) {
          return NextResponse.json({
            detail: {
              name: card.name,
              band: band(card.matchScore),
              matchScore: card.matchScore,
              label: card.investorType ? titleCase(card.investorType) : "Investor",
              fitSector: card.fitSector,
              fitStage: card.fitStage,
              fitCheck: card.fitCheck,
              fitGeo: card.fitGeo,
              sectors: card.sectors,
              capitalTypes: card.capitalTypes,
              stages: card.stages,
              geographies: card.geographies,
              checkSize: card.checkBand ?? "—",
              pledgeCount: 0,
              indicated: 0,
              investorScore: null,
              scoreTier: null,
              scoreRated: false,
            },
            introRef: card.ref,
            hideFit: false,
          });
        }
      }
    } catch {
      // fall through to the basic view below
    }
  }

  // Manual investor (or match no longer available) → basic detail, no fit bars.
  const score = typeof inv.match_score === "number" ? inv.match_score : 0;
  return NextResponse.json({
    detail: {
      name: inv.name,
      band: band(score),
      matchScore: score,
      label: inv.investor_type ?? "Investor",
      fitSector: 0,
      fitStage: 0,
      fitCheck: 0,
      fitGeo: 0,
      sectors: (inv.focus_sectors as string[] | null) ?? [],
      capitalTypes: [],
      stages: (inv.preferred_stages as string[] | null) ?? [],
      geographies: inv.location ? [inv.location as string] : [],
      checkSize: (inv.investment_size as string | null) ?? "—",
      pledgeCount: inv.pledge_amount ? 1 : 0,
      indicated: (inv.pledge_amount as number | null) ?? 0,
      investorScore: null,
      scoreTier: null,
      scoreRated: false,
    },
    introRef: null,
    hideFit: true,
  });
}
