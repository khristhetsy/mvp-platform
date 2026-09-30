/**
 * Fill missing investor fields. Staff-only, no AI.
 *   GET                                         → { includeLow }
 *   POST { op: "preview", step }                → { contacts, byField, sample, scanned, defaults? }
 *   POST { op: "apply", step, afterId? }        → { scanned, contacts, fields, byField, errors, nextCursor, done }
 *   POST { op: "undo", step, field? }           → { removed }
 *   POST { op: "include_low", enabled }         → { includeLow, reindexed }
 * step: "stated" (PitchBook notes → industry) | "guess" (same-type statistics).
 * See src/lib/investors/fill-missing.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readAllRows } from "@/lib/supabase/paged";
import { planFill, applyFill, undoFill, countByField, loadTypeDefaults } from "@/lib/investors/fill-missing";
import { INCLUDE_LOW_CONFIDENCE_KEY, LOW_CONFIDENCE_TAG } from "@/lib/fit/match-investors";
import { reindexContacts } from "@/lib/fit/match-index";
import { getBoolSetting, setBoolSetting } from "@/lib/settings/platform-settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const step = z.enum(["stated", "guess"]);
const schema = z.union([
  z.object({ op: z.literal("preview"), step }),
  z.object({ op: z.literal("apply"), step, afterId: z.string().uuid().optional() }),
  z.object({ op: z.literal("undo"), step, field: z.string().max(30).optional() }),
  z.object({ op: z.literal("include_low"), enabled: z.boolean() }),
]);

async function staff() {
  return requireRole(["admin", "analyst"]).catch(() => null);
}

export async function GET(): Promise<Response> {
  if (!(await staff())) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  return NextResponse.json({ includeLow: await getBoolSetting(INCLUDE_LOW_CONFIDENCE_KEY, false) });
}

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await staff();
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;

  if (body.op === "preview") {
    const defaults = body.step === "guess" ? await loadTypeDefaults(true) : undefined;
    const { items, scanned } = await planFill(body.step, { defaults });
    return NextResponse.json({
      contacts: new Set(items.map((i) => i.contactId)).size,
      byField: countByField(items),
      sample: items.slice(0, 30).map((i) => ({ contactId: i.contactId, company: i.company, field: i.field, values: i.values })),
      scanned,
      defaults,
    });
  }
  if (body.op === "apply") return NextResponse.json(await applyFill(body.step, { afterId: body.afterId }));
  if (body.op === "undo") return NextResponse.json({ removed: await undoFill(body.step, body.field) });

  // include_low: save, then reproject only the contacts whose values the switch affects.
  const ok = await setBoolSetting(INCLUDE_LOW_CONFIDENCE_KEY, body.enabled, profile.id);
  if (!ok) return NextResponse.json({ error: "Couldn't save the setting." }, { status: 500 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const ids = new Set<string>();
  for (const key of ["_industry_source", "_type_source"]) {
    const rows = await readAllRows<{ id: string }>((from, to) => db.from("crm_contacts")
      .select("id").eq(`overrides->>${key}`, LOW_CONFIDENCE_TAG)
      .order("id", { ascending: true }).range(from, to), { context: "include_low: read" });
    for (const r of rows) ids.add(r.id);
  }
  const reindexed = await reindexContacts([...ids]).catch(() => 0);
  return NextResponse.json({ includeLow: body.enabled, reindexed });
}
