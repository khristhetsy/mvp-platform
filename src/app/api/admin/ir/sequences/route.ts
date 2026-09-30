/**
 * Start the same auto sequence on several investor records at once (matching queue ›
 * "Confirm + auto sequence"). Uses a template's steps as they are; the first emails go
 * out on the next sequence run (every 15 minutes), not inside this request.
 *   GET  → { setupNeeded } — false once migration 20260928100000 is applied
 *   POST { matchIds[], template (built-in key or saved sequence id), via, includeOnePager, managerId, notifyEvents, notifyEmail, stopOn } → { started, skipped: [{ matchId, error }] }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { startSequence } from "@/lib/ir/sequences";
import { db } from "@/lib/ir/db";
import { SEQUENCE_TEMPLATES, type SequenceStep } from "@/lib/ir/sequence-templates";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const probe = await db().from("ir_sequence_enrollments").select("id", { head: true, count: "exact" }).limit(1);
  return NextResponse.json({ setupNeeded: !!probe.error });
}

const schema = z.object({
  matchIds: z.array(z.string().uuid()).min(1).max(200), template: z.string(), via: z.enum(["icapos", "gmail"]), includeOnePager: z.boolean().default(false),
  managerId: z.string().uuid(), notifyEvents: z.array(z.enum(["open", "click", "reply", "meeting"])).default(["open", "click", "reply", "meeting"]),
  notifyEmail: z.boolean().default(true), stopOn: z.array(z.enum(["reply", "meeting"])).default(["reply", "meeting"]),
});

export async function POST(req: NextRequest): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const d = parsed.data;
  // A built-in sequence key, or the id of one saved from the Enroll in sequence menu.
  let tpl: { steps: SequenceStep[] } | undefined = SEQUENCE_TEMPLATES[d.template];
  if (!tpl && z.string().uuid().safeParse(d.template).success) {
    const { data } = await db().from("ir_sequence_templates").select("steps").eq("id", d.template).maybeSingle();
    if (data) tpl = { steps: (data as { steps: SequenceStep[] }).steps };
  }
  if (!tpl) return NextResponse.json({ error: "Unknown sequence." }, { status: 400 });
  try {
    let started = 0;
    const skipped: Array<{ matchId: string; error: string }> = [];
    for (const matchId of d.matchIds) {
      const r = await startSequence({ matchId, template: d.template, steps: tpl.steps, via: d.via, includeOnePager: d.includeOnePager, skipFirst: false, managerId: d.managerId, watcherIds: [], notifyEvents: d.notifyEvents, notifyEmail: d.notifyEmail, stopOn: d.stopOn, by: me.id, sendNow: false });
      if (r.ok) started++; else skipped.push({ matchId, error: r.error });
    }
    return NextResponse.json({ started, skipped });
  } catch (e) { return failed(e, "Couldn't start the sequences."); }
}
