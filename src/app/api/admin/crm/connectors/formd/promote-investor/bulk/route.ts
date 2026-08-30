import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Bulk sibling of the single promote-investor route (§9). One lawful basis is
// recorded for the whole batch (§15). Two selection modes:
//   - firmIds: an explicit list (the rows the user checked), or
//   - all:true + q/band: "select all matching the current filter" — resolved
//     server-side so the client never has to ship ~1,300 ids.
// Each firm goes through promote_prospect_investor() individually, so the OFAC
// hard-stop, dedupe cascade, and per-record lawful basis all still apply; OFAC
// hits are counted as "blocked", never promoted.
const schema = z.object({
  lawfulBasis: z.string().min(1).max(200),
  firmIds: z.array(z.string().uuid()).max(5000).optional(),
  all: z.boolean().optional(),
  q: z.string().max(200).optional(),
  band: z.string().max(40).optional(),
});

const MAX_BATCH = 5000;

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A lawful basis and a selection are required." }, { status: 400 });
  const { lawfulBasis, firmIds, all, q, band } = parsed.data;

  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as SupabaseClient<any>;

  // Resolve the target firm ids.
  let ids: string[] = [];
  if (all) {
    // Mirror the firms-list filter so "select all" matches exactly what's on screen.
    let query = db.from("formd_firms").select("id, display_name").limit(MAX_BATCH);
    if (band === "review") query = query.eq("needs_review", true);
    else if (band) query = query.eq("activity_band", band);
    if (q) query = query.ilike("display_name", `%${q}%`);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    ids = (data ?? []).map((r: { id: string }) => String(r.id));
  } else if (firmIds && firmIds.length) {
    ids = firmIds.slice(0, MAX_BATCH);
  }

  if (!ids.length) return NextResponse.json({ error: "No firms selected." }, { status: 400 });

  let created = 0, matched = 0, review = 0, blocked = 0, failed = 0;
  const blockedIds: string[] = [];

  for (const firmId of ids) {
    const { data, error } = await db.rpc("promote_prospect_investor", {
      p_firm_id: firmId,
      p_lawful_basis: lawfulBasis,
    });
    if (error) {
      if (/ofac/i.test(error.message)) { blocked++; blockedIds.push(firmId); }
      else failed++;
      continue;
    }
    const action = (data as { action?: string } | null)?.action;
    if (action === "matched") matched++;
    else if (action === "review") review++;
    else created++;
  }

  // Name the OFAC-blocked firms so the desk can show which were skipped.
  let blockedNames: string[] = [];
  if (blockedIds.length) {
    const { data } = await db.from("formd_firms").select("display_name").in("id", blockedIds.slice(0, 25));
    blockedNames = (data ?? []).map((r: { display_name: string }) => String(r.display_name));
  }

  return NextResponse.json({ total: ids.length, created, matched, review, blocked, failed, blockedNames });
}
