import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { loadFounderMatchingCenter } from "@/lib/matching/founder-matching-center";

export const dynamic = "force-dynamic";

function untyped(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

// GET — the investors the founder sees on the Investor matches page (the named
// directory, members + prospects), formatted for the pipeline import modal so
// the pipeline mirrors that list exactly.
export async function GET() {
  try {
    const auth = await requireApiProfile(["founder"]);
    if ("error" in auth) return auth.error;
    const { supabase, profile } = auth;

    const company = await ensureFounderCompanyForUser(profile);
    if (!company) {
      return NextResponse.json(
        { error: "No company profile found. Complete your company setup first.", code: "no_company" },
        { status: 400 },
      );
    }

    let data;
    try {
      data = await loadFounderMatchingCenter(company);
    } catch (matchErr) {
      console.error("[investor-pipeline/matches] loadFounderMatchingCenter failed:", matchErr);
      return NextResponse.json(
        { error: "Could not load investor matches. Try again in a moment.", code: "matching_error" },
        { status: 500 },
      );
    }

    if (!data.cards.length) {
      return NextResponse.json({ matches: [], message: "No investor matches yet." });
    }

    // Already-imported detection: members are keyed by platform_investor_id
    // (their profile id), prospects by name (they have no platform account).
    const { data: existing } = await untyped(supabase)
      .from("pipeline_investors")
      .select("platform_investor_id, name")
      .eq("founder_id", profile.id);

    const importedIds = new Set<string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (existing ?? []).map((r: any) => r.platform_investor_id).filter(Boolean).map(String),
    );
    const importedNames = new Set<string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (existing ?? []).map((r: any) => String(r.name ?? "").trim().toLowerCase()).filter(Boolean),
    );

    const matches = data.cards.map((c) => ({
      investorId: c.ref,
      investorName: c.name,
      investorType: c.investorType,
      investmentSize: c.checkBand ?? "Not set",
      focusSectors: c.sectors,
      geographies: c.geographies,
      matchScore: c.matchScore,
      matchReasons: c.reasons,
      isProspect: c.isProspect,
      alreadyImported: c.isProspect
        ? importedNames.has(c.name.trim().toLowerCase())
        : importedIds.has(c.ref),
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
