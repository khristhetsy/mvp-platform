/**
 * Auto sequence on one investor record.
 *   GET  → { enrollment | null, events, templates, setupNeeded }
 *   POST { action: "start", template, steps, via, includeOnePager, skipFirst, managerId, watcherIds, notifyEvents, notifyEmail, stopOn } → { ok, id }
 *   POST { action: "pause" | "resume" | "stop" | "reply" } → { ok }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db } from "@/lib/ir/db";
import { controlSequence, getLiveEnrollment, listEvents, startSequence } from "@/lib/ir/sequences";
import { SEQUENCE_TEMPLATES } from "@/lib/ir/sequence-templates";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    // Until the migration is applied the tables don't exist; say so instead of failing.
    const probe = await db().from("ir_sequence_enrollments").select("id", { head: true, count: "exact" }).limit(1);
    if (probe.error) return NextResponse.json({ enrollment: null, events: [], templates: SEQUENCE_TEMPLATES, setupNeeded: true });
    const enrollment = await getLiveEnrollment(id);
    const events = enrollment ? await listEvents(enrollment.id) : [];
    return NextResponse.json({ enrollment, events, templates: SEQUENCE_TEMPLATES, setupNeeded: false });
  } catch (e) { return failed(e, "Couldn't load the sequence."); }
}

const step = z.object({ day: z.number().int().min(0).max(365), subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(8000) });
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"), template: z.string().max(60), steps: z.array(step).min(1).max(10), via: z.enum(["icapos", "gmail"]),
    includeOnePager: z.boolean().default(false), skipFirst: z.boolean().default(false), managerId: z.string().uuid(), watcherIds: z.array(z.string().uuid()).max(5).default([]),
    notifyEvents: z.array(z.enum(["open", "click", "reply", "meeting"])).default(["open", "click", "reply", "meeting"]), notifyEmail: z.boolean().default(true),
    stopOn: z.array(z.enum(["reply", "meeting"])).default(["reply", "meeting"]),
  }),
  z.object({ action: z.enum(["pause", "resume", "stop", "reply"]) }),
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  try {
    const d = parsed.data;
    const r = d.action === "start"
      ? await startSequence({ matchId: id, template: d.template, steps: d.steps, via: d.via, includeOnePager: d.includeOnePager, skipFirst: d.skipFirst, managerId: d.managerId, watcherIds: d.watcherIds, notifyEvents: d.notifyEvents, notifyEmail: d.notifyEmail, stopOn: d.stopOn, by: me.id })
      : await controlSequence(id, d.action, me.id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json(r);
  } catch (e) { return failed(e, "Couldn't update the sequence."); }
}
