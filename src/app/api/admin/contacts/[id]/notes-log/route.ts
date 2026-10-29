/**
 * Notes log for one admin CRM contact: notes and every logged communication.
 *   GET ?kind=all|notes|email|messages|calls|sequences|marketing  (default all)
 *       &before=<ISO>                                            (optional)
 *   → { entries, hasMore, cutoff, counts }
 * No `before`: the last 12 months, newest first, plus per chip counts (recent / older).
 * `before` inside the 12 months: the next page (Load more). `before` at or before
 * `cutoff`: entries older than 1 year (Show more). See src/lib/notes-log.ts.
 * Same access as the Sales Hub contact record: admin / analyst, and non-managers only on
 * contacts they are assigned to. Admin only: no founder page calls this.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getSalesScope } from "@/lib/sales/scope";
import { getContactProfile } from "@/lib/sales/contacts";
import { isNotesLogChip, listNotesLog } from "@/lib/notes-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const scope = await getSalesScope(profile);
  if (!scope.isManager) {
    const c = (await getContactProfile(id))?.contact;
    if (!c || !c.assignee_ids.includes(scope.ownerId ?? "")) return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const kind = req.nextUrl.searchParams.get("kind") ?? "all";
  if (!isNotesLogChip(kind)) return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  const before = req.nextUrl.searchParams.get("before");
  if (before && Number.isNaN(new Date(before).getTime())) return NextResponse.json({ error: "Invalid before." }, { status: 400 });

  try {
    return NextResponse.json(await listNotesLog(id, { chip: kind, before }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load the Notes log." }, { status: 500 });
  }
}
