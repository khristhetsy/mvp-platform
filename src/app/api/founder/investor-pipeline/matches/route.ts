import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { loadFounderMatchingCenter, formatMatchingCheckSize } from "@/lib/matching/matching-center";

export const dynamic = "force-dynamic";

function untyped(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

export async function GET() {
  try {
    const auth = await requireApiProfile(["founder"]);
    if ("error" in auth) return auth.error;
    const { supabase, profile } = auth;

    // Get founder's company
    const company = await ensureFounderCompanyForUser(profile);
    if (!company) {
      return NextResponse.json(
        { error: "No company profile found. Complete your company setup first.", code: "no_company" },
        { status: 400 },
      );
    }

    // Load ranked platform matches via matching engine
    let snapshot;
    try {
      snapshot = await loadFounderMatchingCenter(company);
    } catch (matchErr) {
      console.error("[investor-pipeline/matches] loadFounderMatchingCenter failed:", matchErr);
      return NextResponse.json(
        { error: "Could not load platform matches. Try again in a moment.", code: "matching_error" },
        { status: 500 },
      );
    }

    if (!snapshot.matches.length) {
      return NextResponse.json({ matches: [], message: "No approved investors in the platform yet." });
    }

    // Flag already-imported investors
    const { data: existing } = await untyped(supabase)
      .from("pipeline_investors")
      .select("platform_investor_id")
      .eq("founder_id", profile.id)
      .not("platform_investor_id", "is", null);

    const importedIds = new Set<string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (existing ?? []).map((r: any) => String(r.platform_investor_id)),
    );

    const matches = snapshot.matches.map((row) => ({
      investorId: row.investorId,
      investorName: row.investorName,
      investorType: row.investorType,
      investmentSize: formatMatchingCheckSize(row.checkSizeMin, row.checkSizeMax),
      focusSectors: row.preferredSectors,
      geographies: row.geographies,
      matchScore: row.matchScore,
      matchReasons: row.matchReasons,
      alreadyImported: importedIds.has(row.investorId),
    }));

    return NextResponse.json({ matches });
  } catch (err) {
    console.error("[investor-pipeline/matches] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error.", code: "unknown" },
      { status: 500 },
    );
  }
}
