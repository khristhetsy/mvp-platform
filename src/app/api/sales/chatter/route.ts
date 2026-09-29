/**
 * Chatter timeline for the Sales Hub (opportunity or contact detail).
 *  GET  ?opportunityId= | ?contactCrmId=           → { activity, odooTarget }
 *  GET  ...&deleted=1                                → { deleted } (last 30 days)
 *  POST { text, opportunityId?, contactCrmId?, syncToOdoo? } → log a note
 * An opportunity's timeline merges its own rows, its contact's contact-level notes,
 * and the Odoo chatter of the linked Odoo opportunity and contact.
 * Send message (email) uses the Gmail send route and tasks use /api/sales/tasks. Both
 * already log to sales_activity_log, so they show up here on the next GET.
 * Note edit / delete / restore: /api/sales/chatter/notes/[id].
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createNote, listDeletedNotes, loadTimeline, NoteError } from "@/lib/sales/chatter";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const opportunityId = req.nextUrl.searchParams.get("opportunityId");
  const contactCrmId = req.nextUrl.searchParams.get("contactCrmId");
  if (!opportunityId && !contactCrmId) return NextResponse.json({ activity: [], odooTarget: null });
  const scope = { opportunityId, contactCrmId };
  try {
    if (req.nextUrl.searchParams.get("deleted") === "1") {
      return NextResponse.json({ deleted: await listDeletedNotes(scope) });
    }
    return NextResponse.json(await loadTimeline(scope));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load the note log." }, { status: 500 });
  }
}

const postSchema = z.object({
  text: z.string().min(1).max(4000),
  opportunityId: z.string().uuid().optional().nullable(),
  contactCrmId: z.string().max(120).optional().nullable(),
  syncToOdoo: z.boolean().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A note is required." }, { status: 400 });
  const { text, opportunityId, contactCrmId, syncToOdoo } = parsed.data;
  try {
    const out = await createNote(text, { opportunityId, contactCrmId }, profile.id, Boolean(syncToOdoo));
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    const status = err instanceof NoteError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save note." }, { status });
  }
}
