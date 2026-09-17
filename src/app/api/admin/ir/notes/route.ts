/**
 * IR team notes. Hidden from the founder unless founderVisible (spec 6).
 *   POST { projectId, matchId?, body, founderVisible?, notedOn? } → { id }
 *   PATCH { id, body?, founderVisible? } → { ok }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { createNote, updateNote } from "@/lib/ir/db";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  projectId: z.string().uuid(), matchId: z.string().uuid().nullish(), body: z.string().min(1).max(4000),
  founderVisible: z.boolean().default(false), notedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await irStaff();
  if (!profile) return forbidden();
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Write a note first." }, { status: 400 });
  const d = parsed.data;
  try {
    const { id } = await createNote({ projectId: d.projectId, matchId: d.matchId ?? null, body: d.body.trim(), founderVisible: d.founderVisible, notedOn: d.notedOn, createdBy: profile.id });
    return NextResponse.json({ id });
  } catch (e) { return failed(e, "Couldn't save the note."); }
}

const patchSchema = z.object({ id: z.string().uuid(), body: z.string().min(1).max(4000).optional(), founderVisible: z.boolean().optional() });
export async function PATCH(req: NextRequest): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  try {
    await updateNote(parsed.data.id, { body: parsed.data.body, founder_visible: parsed.data.founderVisible });
    return NextResponse.json({ ok: true });
  } catch (e) { return failed(e, "Couldn't update the note."); }
}
