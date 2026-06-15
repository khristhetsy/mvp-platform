import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { loadFounderMatchingCenter, formatMatchingCheckSize } from "@/lib/matching/matching-center";

function untyped(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

export async function GET() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { supabase, profile } = auth;

  const company = await ensureFounderCompanyForUser(profile);
  if (!company) {
    return NextResponse.json({ error: "Company profile not found." }, { status: 400 });
  }

  // Load platform-ranked matches
  const snapshot = await loadFounderMatchingCenter(company);

  // Load existing pipeline_investor platform_investor_ids so we can flag already-imported ones
  const { data: existing } = await untyped(supabase)
    .from("pipeline_investors")
    .select("platform_investor_id")
    .eq("founder_id", profile.id)
    .not("platform_investor_id", "is", null);

  const importedIds = new Set<string>(
    (existing ?? []).map((r: { platform_investor_id: string }) => r.platform_investor_id)
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
}
