/**
 * Merge duplicate contacts. Staff only.
 *   GET  ?ids=a,b[,…]  → { candidates, defaults: { keepId, fields } } for the Merge dialog
 *   POST { keepId, mergeIds, fields } → merges (one transaction, logged, undoable) → MergeResult
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { loadMergeCandidates, mergeContacts } from "@/lib/sales/merge-contacts";
import { MERGE_FIELDS, defaultMergeChoice } from "@/lib/sales/merge-contacts-shared";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const ids = [...new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean))];
  if (ids.length < 2 || ids.length > 10 || !ids.every((id) => uuid.safeParse(id).success)) {
    return NextResponse.json({ error: "Select between 2 and 10 contacts to merge." }, { status: 400 });
  }
  try {
    const candidates = await loadMergeCandidates(ids);
    if (candidates.length < 2) return NextResponse.json({ error: "Some of those contacts no longer exist. Refresh the list." }, { status: 404 });
    return NextResponse.json({ candidates, defaults: defaultMergeChoice(candidates) });
  } catch {
    return NextResponse.json({ error: "Couldn't load those contacts." }, { status: 500 });
  }
}

const fieldKeys = MERGE_FIELDS.map((f) => f.key) as [string, ...string[]];
const schema = z.object({
  keepId: uuid,
  mergeIds: z.array(uuid).min(1).max(9),
  fields: z.partialRecord(z.enum(fieldKeys), uuid).default({}),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid merge request." }, { status: 400 });
  const { keepId, mergeIds, fields } = parsed.data;
  const allowed = new Set([keepId, ...mergeIds]);
  if (Object.values(fields).some((id) => !id || !allowed.has(id))) return NextResponse.json({ error: "A field points at a contact outside this merge." }, { status: 400 });
  try {
    return NextResponse.json(await mergeContacts({ keepId, mergeIds, fields, by: profile.id }));
  } catch (e) {
    // Messages raised by merge_crm_contacts are written for the user; anything else is generic.
    const msg = e instanceof Error ? e.message : "";
    const userFacing = /^(Pick a contact|The kept contact|Merge at most|The contact to keep|One of the contacts|Field )/.test(msg);
    return NextResponse.json({ error: userFacing ? msg : "Couldn't merge those contacts." }, { status: userFacing ? 400 : 500 });
  }
}
