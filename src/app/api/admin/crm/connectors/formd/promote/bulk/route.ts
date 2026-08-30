import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listFilings, promoteFiling, type SavedView, type FilingFilters } from "@/lib/formd/store";

export const dynamic = "force-dynamic";

// Bulk sibling of the single founder promote route (§8/§9). Admin-only, like the
// single route. Two selection modes:
//   - accessionNos: the exact filings the user checked, or
//   - all:true + view/minScore: "select all matching the current view" — resolved
//     server-side via listFilings so the client never ships every accession number.
// Bulk forces resolve:"create" (a batch can't stop to adjudicate each possible
// match); already-promoted filings are skipped. The per-filing dedupe-by-CIK still
// runs inside promoteFiling, so a re-run updates rather than duplicates.
const VIEWS: SavedView[] = ["eligible", "stall_window", "aging_in", "agent_watch", "all"];

const schema = z.object({
  accessionNos: z.array(z.string().max(200)).max(5000).optional(),
  all: z.boolean().optional(),
  view: z.string().max(40).optional(),
  minScore: z.number().min(0).max(100).optional(),
});

const MAX_BATCH = 5000;

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A selection is required." }, { status: 400 });
  const { accessionNos, all, view, minScore } = parsed.data;

  let ids: string[] = [];
  if (all) {
    const v: SavedView = view && VIEWS.includes(view as SavedView) ? (view as SavedView) : "eligible";
    const filters: FilingFilters = {
      view: v,
      minScore: v === "all" || v === "agent_watch" ? 0 : minScore ?? 0,
      limit: MAX_BATCH,
    };
    const { rows } = await listFilings(filters);
    ids = rows.filter((r) => !r.promotedContactId).map((r) => r.accessionNo);
  } else if (accessionNos && accessionNos.length) {
    ids = accessionNos.slice(0, MAX_BATCH);
  }

  if (!ids.length) return NextResponse.json({ error: "No filings selected." }, { status: 400 });

  let created = 0, updated = 0, linked = 0, failed = 0;
  for (const accessionNo of ids) {
    try {
      const result = await promoteFiling(accessionNo, profile.id, { resolve: "create" });
      if (result.action === "created") created++;
      else if (result.action === "updated") updated++;
      else if (result.action === "linked") linked++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ total: ids.length, created, updated, linked, failed });
}
