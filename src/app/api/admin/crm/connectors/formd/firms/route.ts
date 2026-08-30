import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Investor-mode Desk data: firms from the rollup, ordered by observed activity
// then vehicle count. Band gates what the UI may show as a number (§8.2/§8.5) —
// this returns the raw fields; the client renders the band-safe labels.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const band = req.nextUrl.searchParams.get("band"); // observed | single | registry | review | null
  const minRank = Number(req.nextUrl.searchParams.get("minRank") ?? "0") || 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as unknown as SupabaseClient<any>;

  // Header chip counts (cheap count queries).
  const countBand = async (b?: string) => {
    let c = admin.from("formd_firms").select("*", { count: "exact", head: true });
    if (b) c = c.eq("activity_band", b);
    const { count } = await c;
    return count ?? 0;
  };
  const { count: reviewCount } = await admin.from("formd_firms").select("*", { count: "exact", head: true }).eq("needs_review", true);
  const counts = {
    observed: await countBand("observed"),
    single: await countBand("single"),
    registry: await countBand("registry"),
    review: reviewCount ?? 0,
    total: await countBand(),
  };

  let query = admin
    .from("formd_firms")
    .select(
      "id, display_name, city, state_or_country, phone, domain, vehicle_count, regd_footprint, fund_types, needs_review, promoted_at, last_investment_at, last_investment_issuer, last_investment_round_size, last_investment_confidence, est_check_size, investments_24mo, sectors_observed, activity_band, formd_rank",
    )
    .order("activity_band", { ascending: true })
    .order("vehicle_count", { ascending: false })
    .limit(200);

  if (band === "review") query = query.eq("needs_review", true);
  else if (band) query = query.eq("activity_band", band);
  if (minRank > 0) query = query.gte("formd_rank", minRank); // rated firms only when a floor is set
  if (q) query = query.ilike("display_name", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const list = (data ?? []) as Record<string, unknown>[];

  // Attach the latest firm-level screening results (OFAC / SEC / IAPD) so the Desk
  // can flag hits and reviews.
  const ids = list.map((f) => String(f.id));
  const byCheck: Record<string, Map<string, string>> = { ofac_sdn: new Map(), sec_enforcement: new Map(), iapd_status: new Map() };
  if (ids.length) {
    const { data: screen } = await admin
      .from("formd_screening")
      .select("subject_id, check_type, result, checked_at")
      .eq("subject_type", "firm")
      .in("subject_id", ids)
      .order("checked_at", { ascending: false });
    for (const s of (screen ?? []) as Record<string, unknown>[]) {
      const m = byCheck[String(s.check_type)];
      if (!m) continue;
      const key = String(s.subject_id);
      if (!m.has(key)) m.set(key, String(s.result)); // first = latest
    }
  }
  for (const f of list) {
    const id = String(f.id);
    f.ofac = byCheck.ofac_sdn.get(id) ?? null;
    f.sec = byCheck.sec_enforcement.get(id) ?? null;
    f.iapd = byCheck.iapd_status.get(id) ?? null;
  }

  // Present order: observed → single → registry (activity first).
  const rank: Record<string, number> = { observed: 0, single: 1, registry: 2 };
  const firms = list.sort(
    (a, b) =>
      (rank[String(a.activity_band)] ?? 3) - (rank[String(b.activity_band)] ?? 3) ||
      Number(b.vehicle_count ?? 0) - Number(a.vehicle_count ?? 0),
  );

  return NextResponse.json({ firms, counts });
}
