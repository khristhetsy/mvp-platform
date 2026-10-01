/**
 * Autosaving contact edits for the IR "Open: Contact" window. See src/lib/contacts/inline-edit.ts.
 *   GET                        → EditorData { contact, tags, odoo }
 *   GET ?history=1             → { history }
 *   POST { op: "save", key, values, restoreTag? } → SaveResult { before, after, tagBefore, odoo }
 *   POST { op: "confirm", key }                   → { tag }   (the tag removed, for Undo)
 *   POST { op: "restore_tag", sourceKey, tag }    → { ok }
 * Same access as the Sales Hub contact record: admin / analyst, and non-managers only on
 * contacts they are assigned to. Only admins' saves reach Odoo.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { getSalesScope } from "@/lib/sales/scope";
import { getContactProfile } from "@/lib/sales/contacts";
import { loadEditor, saveField, confirmField, restoreTag, editHistory } from "@/lib/contacts/inline-edit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const tag = z.object({ sourceKey: z.string().regex(/^_[a-z_]+_source$/), tag: z.string().min(1).max(80) });
const schema = z.union([
  z.object({ op: z.literal("save"), key: z.string().min(1).max(200), values: z.array(z.string().max(4000)).max(40), restoreTag: tag.nullish() }),
  z.object({ op: z.literal("confirm"), key: z.string().min(1).max(200) }),
  z.object({ op: z.literal("restore_tag"), sourceKey: tag.shape.sourceKey, tag: tag.shape.tag }),
]);

async function gate(id: string) {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return { ok: false as const, res: NextResponse.json({ error: "Staff only." }, { status: 403 }) };
  const scope = await getSalesScope(profile);
  if (!scope.isManager) {
    const c = (await getContactProfile(id))?.contact;
    if (!c || !c.assignee_ids.includes(scope.ownerId ?? "")) return { ok: false as const, res: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  }
  return { ok: true as const, profile };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const g = await gate(id);
  if (!g.ok) return g.res;
  try {
    if (req.nextUrl.searchParams.get("history")) return NextResponse.json({ history: await editHistory(id) });
    const data = await loadEditor(id, g.profile.role === "admin");
    if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load the contact." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const g = await gate(id);
  if (!g.ok) return g.res;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;
  const actor = { id: g.profile.id, isAdmin: g.profile.role === "admin" };
  try {
    if (body.op === "save") return NextResponse.json(await saveField(id, { key: body.key, values: body.values, restoreTag: body.restoreTag ?? null }, actor));
    if (body.op === "confirm") return NextResponse.json({ tag: await confirmField(id, body.key, actor.id) });
    await restoreTag(id, { sourceKey: body.sourceKey, tag: body.tag });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Save failed." }, { status: 500 });
  }
}
