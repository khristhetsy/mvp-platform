/**
 * GET /api/sales/analytics/followup?grain=30d&compare=prev            → FollowupResults
 * GET /api/sales/analytics/followup?grain=30d&sequence=<uuid>         → SequenceDetail
 * Staff-only. Errors are returned, never swallowed into zeros.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { GRAINS, loadFollowupResults, loadSequenceDetail, type Compare, type Grain } from "@/lib/sales/followup-analytics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const grainRaw = p.get("grain") ?? "30d";
  const grain = (GRAINS as string[]).includes(grainRaw) ? (grainRaw as Grain) : "30d";
  const compare: Compare = p.get("compare") === "yoy" ? "yoy" : "prev";
  const sequence = p.get("sequence");
  try {
    if (sequence) {
      if (!/^[0-9a-f-]{36}$/i.test(sequence)) return NextResponse.json({ error: "Invalid sequence id." }, { status: 400 });
      return NextResponse.json(await loadSequenceDetail(sequence, grain));
    }
    return NextResponse.json(await loadFollowupResults(grain, compare));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load follow-up results." }, { status: 500 });
  }
}
