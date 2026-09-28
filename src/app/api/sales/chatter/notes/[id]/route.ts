/**
 * One note in the Sales Hub note log. `id` is an iCapOS row id, or "odoo:<messageId>"
 * for an Odoo note not yet changed in iCapOS (it gets an iCapOS copy on first change).
 *  PATCH  { action: "edit", text, undo?: { editedAt }, opportunityId?, contactCrmId? }
 *  PATCH  { action: "restore", opportunityId?, contactCrmId? }
 *  DELETE ?opportunityId=&contactCrmId=   → soft delete (Undo / Recently deleted restore it)
 * Changes stay in iCapOS: Odoo's own copy of a note is never edited or deleted.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { deleteNote, editNote, NoteError, restoreNote } from "@/lib/sales/chatter";

export const dynamic = "force-dynamic";

const scopeSchema = {
  opportunityId: z.string().uuid().optional().nullable(),
  contactCrmId: z.string().max(120).optional().nullable(),
};
const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), text: z.string().min(1).max(4000), undo: z.object({ editedAt: z.string().nullable() }).optional(), ...scopeSchema }),
  z.object({ action: z.literal("restore"), ...scopeSchema }),
]);

function fail(err: unknown): Response {
  const status = err instanceof NoteError ? err.status : 500;
  return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong." }, { status });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const d = parsed.data;
  const scope = { opportunityId: d.opportunityId, contactCrmId: d.contactCrmId };
  try {
    const note = d.action === "edit"
      ? await editNote(decodeURIComponent(id), d.text, scope, profile.id, d.undo)
      : await restoreNote(decodeURIComponent(id), scope, profile.id);
    return NextResponse.json({ ok: true, note });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const opportunityId = req.nextUrl.searchParams.get("opportunityId");
  const contactCrmId = req.nextUrl.searchParams.get("contactCrmId");
  if (opportunityId && !z.string().uuid().safeParse(opportunityId).success) return NextResponse.json({ error: "Invalid opportunity." }, { status: 400 });
  try {
    const note = await deleteNote(decodeURIComponent(id), { opportunityId, contactCrmId }, profile.id);
    return NextResponse.json({ ok: true, note });
  } catch (err) {
    return fail(err);
  }
}
